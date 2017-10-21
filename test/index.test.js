'use strict';

var AWS = require('aws-sdk-mock');
var chai = require("chai");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
var expect = chai.expect;
var LambdaTester = require( 'lambda-tester' );
var index = require( '../index' );
var sinon = require('sinon');


describe( 'handlePipelineEvent', function() {
    [
        {
            description: "action succeeded",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Action Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'stage': 'commit',
                    'action': 'compile',
                    'state': 'SUCCEEDED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "SuccessCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                            {Name: "StageName", Value: "commit"},
                            {Name: "ActionName", Value: "compile"}
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "stage succeeded",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Stage Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'stage': 'commit',
                    'state': 'SUCCEEDED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "SuccessCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                            {Name: "StageName", Value: "commit"},
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "pipeline succeeded",
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pieplineExecutionId': 'xxx',
                        'startTime': new Date(1492830907000),
                    }
                ]
            },
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Pipeline Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'state': 'SUCCEEDED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "SuccessCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "action failed",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Action Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'stage': 'commit',
                    'action': 'compile',
                    'state': 'FAILED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "FailureCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                            {Name: "StageName", Value: "commit"},
                            {Name: "ActionName", Value: "compile"}
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "stage failed",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Stage Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'stage': 'commit',
                    'state': 'FAILED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "FailureCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                            {Name: "StageName", Value: "commit"},
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "pipeline failed",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail-type': 'CodePipeline Pipeline Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'state': 'FAILED',
                }
            },
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pieplineExecutionId': 'xxx',
                        'startTime': new Date(1492830907000),
                    }
                ]
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "FailureCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 1,
                    }
                ]
            }]
        },
        {
            description: "ignore STARTED",
            event: {
                'time': '2017-04-22T03:31:47Z',
                'detail': {
                    'state': 'STARTED',
                }
            },
            metrics: []
        }
    ].forEach(scenario => {
        if (scenario.skip) {
            return;
        }
        it(`handles scenario successfully - ${scenario.description}`, () => {

            let putMetricDataSpy = sinon.spy();

            AWS.mock('CloudWatch', 'putMetricData', (params, cb) => {
                putMetricDataSpy(params);
                cb();
            });

            let listPipelineExecutionsSpy = sinon.spy();

            AWS.mock('CodePipeline', 'listPipelineExecutions', (params, cb) => {
                listPipelineExecutionsSpy(params);
                cb(null, scenario.pipelineHistory);
            });

            return LambdaTester(index.handlePipelineEvent)
                .event(scenario.event)
                .expectResult((result, additional) => {
                    expect(putMetricDataSpy).to.have.callCount(scenario.metrics.length);
                    scenario.metrics.forEach(metric => {
                        expect(putMetricDataSpy).to.have.been.calledWith(metric);
                    });

                    AWS.restore('CloudWatch');
                    AWS.restore('CodePipeline');
                });
        });
    });
});


