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
                        'pipelineExecutionId': 'xxx',
                        'startTime': new Date(1492830707000),
                        'lastUpdateTime': new Date(1492830907000),
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
                        'startTime': new Date(1492830707000),
                        'lastUpdateTime': new Date(1492830907000),
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
        },
        {
            description: "pipeline with RedTime",
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pipelineExecutionId': 'xxx',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830907000),
                        'lastUpdateTime': new Date(1492831007000),
                    },
                    {
                        'pipelineExecutionId': 'yyy',
                        'status': 'Failed',
                        'startTime': new Date(1492830707000),
                        'lastUpdateTime': new Date(1492830807000),
                    },
                    {
                        'pipelineExecutionId': 'zzz',
                        'status': 'Failed',
                        'startTime': new Date(1492830507000),
                        'lastUpdateTime': new Date(1492830607000),
                    },
                    {
                        'pipelineExecutionId': 'aaa',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830207000),
                        'lastUpdateTime': new Date(1492830407000),
                    }
                ]
            },
            event: {
                'time': '2017-04-22T03:16:47Z',
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
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "RedTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 400,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessCycleTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 600,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 100,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "DeliveryLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 500,
                    }
                ]
            }]
        },
        {
            description: "pipeline with GreenTime",
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pipelineExecutionId': 'xxx',
                        'status': 'Failed',
                        'startTime': new Date(1492830907000),
                        'lastUpdateTime': new Date(1492831007000),
                    },
                    {
                        'pipelineExecutionId': 'yyy',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830807000),
                    },
                    {
                        'pipelineExecutionId': 'zzz',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830507000),
                        'lastUpdateTime': new Date(1492830607000),
                    },
                    {
                        'pipelineExecutionId': 'aaa',
                        'status': 'Failed',
                    }
                ]
            },
            event: {
                'time': '2017-04-22T03:16:47Z',
                'detail-type': 'CodePipeline Pipeline Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'state': 'FAILED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "GreenTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 400,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 100,
                    }
                ]
            }]
        },
        {
            description: "pipeline state unchanged",
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pipelineExecutionId': 'xxx',
                        'status': 'Failed',
                        'startTime': new Date(1492830907000),
                        'lastUpdateTime': new Date(1492831007000),
                    },
                    {
                        'pipelineExecutionId': 'yyy',
                        'status': 'Failed',
                        'startTime': new Date(1492830807000),
                    },
                    {
                        'pipelineExecutionId': 'zzz',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830507000),
                        'lastUpdateTime': new Date(1492830607000),
                    }
                ]
            },
            event: {
                'time': '2017-04-22T03:16:47Z',
                'detail-type': 'CodePipeline Pipeline Execution State Change',
                'detail': {
                    'pipeline': 'my-pipeline',
                    'execution-id': 'xxx',
                    'state': 'FAILED',
                }
            },
            metrics: [{
                "Namespace": "Pipeline",
                "MetricData": [
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureCount",
                        "Unit": "Count",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            {Name: "PipelineName", Value: "my-pipeline"},
                        ],
                        "Value": 100,
                    }
                ]
            }]
        },
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


