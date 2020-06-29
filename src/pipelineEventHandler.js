'use strict';

const https = require('https');

const PIPELINE_EVENT = 'CodePipeline Pipeline Execution State Change';
const STAGE_EVENT = 'CodePipeline Stage Execution State Change';
const ACTION_EVENT = 'CodePipeline Action Execution State Change';

const COUNT = 'Count';
const SECONDS = 'Seconds';

const EVENTS_API_HOST = 'api.stg.cto.sh';
const EVENTS_API_PORT = 443;
const EVENTS_API_TOKEN = process.env.EVENTS_API_TOKEN

const sendEvent = (postBody) => {
        const token = EVENTS_API_TOKEN;;

        var options = {
            hostname: EVENTS_API_HOST,
            port: EVENTS_API_PORT,
            path: '/events',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            }
        };

        const postData = JSON.stringify(postBody);

        var req = https.request(options, (res) => {
            res.on('data', (d) => {
                process.stdout.write(d);
            });
        });

        req.on('error', (e) => {
            console.error(e);
        });

        req.write(postData);
        req.end();
    };

class PipelineEventHandler {
    run(eventPromise) {
        return eventPromise
            .then(this.recordEvents)
            .then(this.initializeState)
            .then(this.handleFinalState)
            .then(this.handlePipelineGreenRedTime)
            .then(this.handlePipelineCycleTime)
            .then(this.handlePipelineLeadTime)
            .then(this.putMetricData);
    }

    recordEvents(state) {
        console.log("AWS CodePipeline Event Info: ", JSON.stringify(state.event));

        // CodePipeline validates the incoming pipeline unique identifier. This
        // will never be null/undefined.
        const pipeline_id = state.event.detail.pipeline;

        // These pipelines have been hardcoded into the AWS Customize Op and the AWS Deploy Op.
        // The CodePipelines and the Op Teams are manually created. This array holds those
        // associations so the event handler knows which team the incoming metrics are for.
        const pipelines = [
            {pipeline_id:"AWS-demo-omar",team_id:"2cfa40ba-8f62-425a-94fe-a22f0f22a8ec"},
            // {pipeline_id:"AWS-demo-app",team_id:""}, // there is no team id for this team, seems unused
            {pipeline_id:"AWS-demo-karim",team_id:"ea3ded11-bd5c-4371-a6b2-047f71e2d3de"},
            {pipeline_id:"AWS-demo-kyle",team_id:"8e8f8fdc-7c98-4896-b080-b47bfcf860d4"},
            {pipeline_id:"AWS-demo-three",team_id:"0aa855f6-fe7b-4bd6-8b68-a6345e41dc34"},
            {pipeline_id:"AWS-demo-two",team_id:"81050f56-da15-41c9-8270-d6f6574b73bc"},
            {pipeline_id:"AWS-demo-one",team_id:"d2ab1965-edea-49dc-9ef1-2c5626b98b07"}
        ];

        const pipeline_match = pipelines.find(o => o.pipeline_id === pipeline_id);

        let team_id = "";
        if (!pipeline_match) {
            console.error("ERROR: Given AWS CodePipeline name does not have an associated Ops Team. Sending a blank team_id to Events API.");
        } else {
            team_id = pipeline_match.team_id;
        }

        const change_id = state.event.detail['execution-id'];
        const payload = {};

        // These if statements check the incoming event to see if they match
        // something we want to store. If there is no match, no Events API
        // request is made.
        if (state.event['detail-type'] === STAGE_EVENT && state.event.detail.state === 'SUCCEEDED') {
            console.log("Change Initiated event");
            sendEvent({
                event_name: "Change Initiated",
                change_id,
                team_id,
                pipeline_id,
                payload
            });
        }

        if (state.event['detail-type'] === PIPELINE_EVENT && state.event.detail.state === 'SUCCEEDED') {
            console.log("Deployment Success event");

            sendEvent({
                event_name: "Change Completed",
                change_id,
                team_id,
                pipeline_id,
                payload
            });

            sendEvent({
                event_name: "Deployment Success",
                change_id,
                team_id,
                pipeline_id,
                payload
            });

        }

        if (state.event['detail-type'] === PIPELINE_EVENT && state.event.detail.state === 'FAILED') {
            console.log("Deployment Failure event");

            sendEvent({
                event_name: "Deployment Failure",
                change_id,
                team_id,
                pipeline_id,
                payload
            });
        }

        return state;
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
                                    pstate.priorSuccessPlusOneExecution = e;
                                }
                                else if (pstate.currentExecution) {
                                    // if current exec is success, find prior success and the one right after that success
                                    if (pstate.currentExecution.status === "Succeeded") {
                                        if (e.status === 'Succeeded') {
                                            pstate.priorSuccessExecution = e;
                                        }
                                        else {
                                            pstate.priorSuccessPlusOneExecution = e;
                                        }
                                    }

                                    // next, if state is different from current, keep it
                                    if (e.status !== pstate.currentExecution.status) {
                                        pstate.priorStateExecution = e;
                                    }
                                    // finally, if state is same as current, we are done!
                                    else if (e.status === pstate.currentExecution.status) {
                                        pstate.isFinal = true;
                                    }
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
        switch (state.event.detail.state) {
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
        let priorStateExecution = state.pipelineState.priorStateExecution;
        if (currentExecution && priorStateExecution) {
            let duration = durationInSeconds(priorStateExecution.startTime, currentExecution.startTime);
            if (currentExecution.status === 'Succeeded') {
                PipelineEventHandler.addMetric(state, 'RedTime', SECONDS, duration);
            }
            else if (currentExecution.status === 'Failed') {
                PipelineEventHandler.addMetric(state, 'GreenTime', SECONDS, duration);
            }
        }
        return state;
    }

    handlePipelineCycleTime(state) {
        let currentExecution = state.pipelineState.currentExecution;
        let priorSuccessExecution = state.pipelineState.priorSuccessExecution;
        if (currentExecution && currentExecution.status === 'Succeeded' && priorSuccessExecution) {
            let duration = durationInSeconds(priorSuccessExecution.lastUpdateTime, currentExecution.lastUpdateTime);
            PipelineEventHandler.addMetric(state, 'SuccessCycleTime', SECONDS, duration);
        }
        return state;
    }

    handlePipelineLeadTime(state) {
        let currentExecution = state.pipelineState.currentExecution;
        if (currentExecution && currentExecution.status === 'Succeeded') {
            let duration = durationInSeconds(currentExecution.startTime, currentExecution.lastUpdateTime);
            PipelineEventHandler.addMetric(state, 'SuccessLeadTime', SECONDS, duration);

            let priorSuccessPlusOneExecution = state.pipelineState.priorSuccessPlusOneExecution;
            if (state.pipelineState.isFinal && priorSuccessPlusOneExecution) {
                let leadDuration = durationInSeconds(priorSuccessPlusOneExecution.startTime, currentExecution.lastUpdateTime);
                PipelineEventHandler.addMetric(state, 'DeliveryLeadTime', SECONDS, leadDuration);
            }
        }
        else if (currentExecution && currentExecution.status === 'Failed') {
            let duration = durationInSeconds(currentExecution.startTime, currentExecution.lastUpdateTime);
            PipelineEventHandler.addMetric(state, 'FailureLeadTime', SECONDS, duration);
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
        if (value === 0) {
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
        if ('pipeline' in eventDetail) {
            metric.Dimensions.push({
                'Name': 'PipelineName',
                'Value': eventDetail.pipeline
            });

            if ('stage' in eventDetail) {
                metric.Dimensions.push({
                    'Name': 'StageName',
                    'Value': eventDetail.stage
                });

                if ('action' in eventDetail) {
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
    return codepipeline.listPipelineExecutions({ 'pipelineName': pipelineName, 'nextToken': nextToken })
        .promise()
        .then(data => {
            if (cb(data.pipelineExecutionSummaries) && data.nextToken) {
                return processPipelineExecutions(codepipeline, pipelineName, cb, data.nextToken);
            }
        });
}

module.exports = PipelineEventHandler;
