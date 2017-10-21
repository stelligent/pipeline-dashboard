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
        return state;
    }

    handleFinalState(state) {
        switch(state.event.detail.state) {
            case 'SUCCEEDED':
                addMetric(state, 'SuccessCount', COUNT, 1);
                break;
            case 'FAILED':
                addMetric(state, 'FailureCount', COUNT, 1);
                break;
        }

        return state;
    }

    handlePipelineGreenRedTime(state) {
        if (state.event['detail-type'] === PIPELINE_EVENT) {
            if (state.event.detail.state === 'SUCCEEDED' || state.event.detail.state === 'FAILED') {
                return getPriorPipelineExecution(state)
                    .then((pipelineExecution) => {
                        if(pipelineExecution) {
                            let duration = Math.round((state.eventTime.getTime() - pipelineExecution.lastUpdateTime.getTime()) / 1000);
                            if (pipelineExecution.status === 'Succeeded') {
                                addMetric(state, 'GreenTime', SECONDS, duration);
                            } else if (pipelineExecution.status === 'Failed') {
                                addMetric(state, 'RedTime', SECONDS, duration);
                            }
                        }
                        return state;
                    });
            }
        }
        return state;
    }
    handlePipelineCycleTime(state) {
        if (state.event['detail-type'] === PIPELINE_EVENT) {
            if (state.event.detail.state === 'SUCCEEDED') {
                return getPipelineExecution(state)
                    .then((pipelineExecution) => {
                        if(pipelineExecution) {
                            let duration = Math.round((state.eventTime.getTime() - pipelineExecution.startTime.getTime()) / 1000);
                            addMetric(state, 'CycleTime', SECONDS, duration);
                        }
                        return state;
                    });
            }
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

}

function addMetric(state, metricName, unit, value) {
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

function getPipelineExecution(state) {
    let pipelineName = state.event.detail.pipeline;
    let executionId = state.event.detail['execution-id'];

    return state.codepipeline.listPipelineExecutions({ 'pipelineName': pipelineName })
        .promise()
        .then(data => {
            return data.pipelineExecutionSummaries.find(e => {
                return e.pipelineExecutionId === executionId;
            });
        });
}

function getPriorPipelineExecution(state) {
    let pipelineName = state.event.detail.pipeline;
    let executionId = state.event.detail['execution-id'];

    return state.codepipeline.listPipelineExecutions({ 'pipelineName': pipelineName })
        .promise()
        .then(data => {
            let foundCurrent = false;
            for (let i in data.pipelineExecutionSummaries) {
                let e = data.pipelineExecutionSummaries[i];
                if(foundCurrent && (e.status === 'Succeeded' || e.status === 'Failed')) {
                    return e;
                } else if(e.pipelineExecutionId === executionId) {
                    foundCurrent = true;
                }
            }
            return null;
        });
}

module.exports = PipelineEventHandler;

