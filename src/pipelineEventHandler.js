'use strict';

const PIPELINE_EVENT = 'CodePipeline Pipeline Execution State Change';
const STAGE_EVENT = 'CodePipeline Stage Execution State Change';
const ACTION_EVENT = 'CodePipeline Action Execution State Change';

const COUNT = 'Count';
const SECONDS = 'Seconds';

class PipelineEventHandler {
    run(eventPromise) {
        return eventPromise
            .then(this.initializeState)
            .then(this.handleFinalState)
            .then(this.handlePipelineGreenRedTime)
            .then(this.handlePipelineCycleTime)
            .then(this.putMetricData);
    }

    initializeState(state) {
        state.eventTime = new Date(state.event.time);
        state.metricData = [];
        state.pipelineState = {};

        if (state.event['detail-type'] === PIPELINE_EVENT) {
            if (state.event.detail.state === 'SUCCEEDED' || state.event.detail.state === 'FAILED') {
                let pipelineName = state.event.detail.pipeline;
                let executionId = state.event.detail['execution-id'];

                return processPipelineExecutions(state.codepipeline, pipelineName, pipelineExecutionSummaries => {
                    state.pipelineState =
                        pipelineExecutionSummaries.filter(e => {
                            return e.status === 'Succeeded' || e.status === 'Failed';
                        }).reduce((pstate, e) => {
                            if (!pstate.isFinal) {
                                // first, find current execution
                                if (e.pipelineExecutionId === executionId) {
                                    pstate.currentExecution = e;
                                }
                                // next, if state is different from current, keep it
                                else if (pstate.currentExecution && e.status !== pstate.currentExecution.status) {
                                    pstate.priorExecution = e;
                                }
                                // finally, if state is same as current, we are done!
                                else if (pstate.currentExecution && e.status === pstate.currentExecution.status) {
                                    pstate.isFinal = true;
                                }
                            }
                            return pstate;
                        }, state.pipelineState);

                    // only continue paging if we don't have a final answer yet
                    return !state.pipelineState.isFinal;
                }).then(() => state);
            }
        }
        return state;
    }

    handleFinalState(state) {
        switch(state.event.detail.state) {
            case 'SUCCEEDED':
                PipelineEventHandler.addMetric(state, 'SuccessCount', COUNT, 1);
                break;
            case 'FAILED':
                PipelineEventHandler.addMetric(state, 'FailureCount', COUNT, 1);
                break;
        }

        return state;
    }

    handlePipelineGreenRedTime(state) {
        let currentExecution = state.pipelineState.currentExecution;
        let priorExecution = state.pipelineState.priorExecution;
        if(currentExecution && priorExecution) {
            let duration = durationInSeconds(priorExecution.lastUpdateTime, currentExecution.startTime);
            if (currentExecution.status === 'Succeeded') {
                PipelineEventHandler.addMetric(state, 'RedTime', SECONDS, duration);
            } else if (currentExecution.status === 'Failed') {
                PipelineEventHandler.addMetric(state, 'GreenTime', SECONDS, duration);
            }
        }
        return state;
    }

    handlePipelineCycleTime(state) {
        let currentExecution = state.pipelineState.currentExecution;
        if(currentExecution && currentExecution.status === 'Succeeded') {
            let duration = durationInSeconds(currentExecution.startTime, state.eventTime);
            PipelineEventHandler.addMetric(state, 'CycleTime', SECONDS, duration);
        }
        return state;
    }

    putMetricData(state) {
        if (state.metricData.length > 0) {
            return state.cloudwatch.putMetricData({
                Namespace: 'Pipeline',
                MetricData: state.metricData
            }).promise();
        }
    }

    static addMetric(state, metricName, unit, value) {
        if(value === 0) {
            return;
        }

        let metric = {
            'Timestamp': state.eventTime,
            'MetricName': metricName,
            'Unit': unit,
            'Value': value,
            'Dimensions': [],
        };

        // add the dimensions to the metric
        let eventDetail = state.event.detail;
        if('pipeline' in eventDetail) {
            metric.Dimensions.push({
                'Name': 'PipelineName',
                'Value': eventDetail.pipeline
            });

            if('stage' in eventDetail) {
                metric.Dimensions.push({
                    'Name': 'StageName',
                    'Value': eventDetail.stage
                });

                if('action' in eventDetail) {
                    metric.Dimensions.push({
                        'Name': 'ActionName',
                        'Value': eventDetail.action
                    });
                }
            }
        }

        state.metricData.push(metric);
    }
}

function durationInSeconds(t1, t2) {
    return Math.round((t2.getTime() - t1.getTime()) / 1000);
}

function processPipelineExecutions(codepipeline, pipelineName, cb, nextToken) {
    return codepipeline.listPipelineExecutions({'pipelineName': pipelineName, 'nextToken': nextToken})
        .promise()
        .then(data => {
            if(cb(data.pipelineExecutionSummaries) && data.nextToken) {
                return processPipelineExecutions(codepipeline, pipelineName, cb, data.nextToken);
            }
        });
}

module.exports = PipelineEventHandler;
