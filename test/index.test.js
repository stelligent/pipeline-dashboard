'use strict';

var AWS = require('aws-sdk-mock');
var awsSdk = require('aws-sdk');
var chai = require("chai");
var sinonChai = require("sinon-chai");
chai.use(sinonChai);
var expect = chai.expect;
var LambdaTester = require('lambda-tester');
var index = require('../index');
var sinon = require('sinon');

describe('handlePipelineEvent', function () {
    [
        {
            description: "pipeline multiple success",
            pipelineHistory: {
                'pipelineExecutionSummaries': [
                    {
                        'pipelineExecutionId': 'xxx',
                        'status': 'Succeeded',
                        'startTime': new Date(1492830907000),
                        'lastUpdateTime': new Date(1492831007000),
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessCycleTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 600,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 100,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "DeliveryLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 100,
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
                        'status': 'Succeeded',
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831907000),
                        "MetricName": "SuccessLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 200,
                    }
                ]
            }]
        },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                            { Name: "StageName", Value: "commit" },
                            { Name: "ActionName", Value: "compile" }
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                            { Name: "StageName", Value: "commit" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                            { Name: "StageName", Value: "commit" },
                            { Name: "ActionName", Value: "compile" }
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                            { Name: "StageName", Value: "commit" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "RedTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 400,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessCycleTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 600,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "SuccessLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 100,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "DeliveryLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "GreenTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 400,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
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
                            { Name: "PipelineName", Value: "my-pipeline" },
                        ],
                        "Value": 1,
                    },
                    {
                        "Timestamp": new Date(1492831007000),
                        "MetricName": "FailureLeadTime",
                        "Unit": "Seconds",
                        "Dimensions": [
                            { Name: "PipelineName", Value: "my-pipeline" },
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
                    AWS.restore('CloudWatch');
                    AWS.restore('CodePipeline');

                    expect(putMetricDataSpy).to.have.callCount(scenario.metrics.length);
                    scenario.metrics.forEach(metric => {
                        expect(putMetricDataSpy).to.have.been.calledWith(metric);
                    });

                });
        });
    });
});

describe("generateDashboardTrend", () => {
    let listMetricsStub;
    let putDashboardSpy;
    var sandbox = sinon.createSandbox();

    function generateMetrics(n) {
        return [...Array(n).keys()].map(idx => {
            return {
                "Namespace": "Pipeline",
                "Dimensions": [
                    {
                        "Name": "PipelineName",
                        "Value": `my-pipeline-${idx}`
                    }
                ],
                "MetricName": "SuccessCount"
            }
        });
    }
    let scenarios = [
        {
            description: "single pipeline",
            uniquePipelines: 1,
            metrics: {
                "Metrics": [
                    {
                        "Namespace": "Pipeline",
                        "Dimensions": [
                            {
                                "Name": "PipelineName",
                                "Value": "my-pipeline"
                            }
                        ],
                        "MetricName": "SuccessCount"
                    },
                    {
                        "Namespace": "Pipeline",
                        "Dimensions": [
                            {
                                "Name": "PipelineName",
                                "Value": "my-pipeline"
                            }
                        ],
                        "MetricName": "SuccessCycleTime"
                    },
                ]
            },
            event: {
                "account": "123456789012",
                "region": "ap-southeast-2",
                "detail": {},
                "detail-type": "Scheduled Event",
                "source": "aws.events",
                "time": "2019-03-01T01:23:45Z",
                "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
                "resources": [
                    "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
                ]
            }
        },
        {
            description: "multiple pipeline",
            uniquePipelines: 2,
            metrics: {
                "Metrics": [
                    {
                        "Namespace": "Pipeline",
                        "Dimensions": [
                            {
                                "Name": "PipelineName",
                                "Value": "pipeline-1"
                            }
                        ],
                        "MetricName": "SuccessCount"
                    },
                    {
                        "Namespace": "Pipeline",
                        "Dimensions": [
                            {
                                "Name": "PipelineName",
                                "Value": "pipeline-2"
                            }
                        ],
                        "MetricName": "SuccessCycleTime"
                    },
                ]
            },
            event: {
                "account": "123456789012",
                "region": "ap-southeast-2",
                "detail": {},
                "detail-type": "Scheduled Event",
                "source": "aws.events",
                "time": "2019-03-01T01:23:45Z",
                "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
                "resources": [
                    "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
                ]
            }
        },
        {
            description: "too many pipelines",
            expectTruncated: true,
            uniquePipelines: 50,

            metrics: {
                "Metrics": generateMetrics(50)
            },
            event: {
                "account": "123456789012",
                "region": "ap-southeast-2",
                "detail": {},
                "detail-type": "Scheduled Event",
                "source": "aws.events",
                "time": "2019-03-01T01:23:45Z",
                "id": "cdc73f9d-aea9-11e3-9d5a-835b769c0d9c",
                "resources": [
                    "arn:aws:events:ap-southeast-2:123456789012:rule/my-schedule"
                ]
            }
        }
    ]

    scenarios.forEach(scenario => {
        describe(scenario.description, () => {
            beforeEach(() => {

                // https://github.com/dwyl/aws-sdk-mock/issues/118
                // Cannot use aws-sdk-mock
                putDashboardSpy = sandbox.stub().returns({
                    // putDashboardSpy = sinon.stub().returns({
                    promise: () => Promise.resolve()
                })

                listMetricsStub = sandbox.stub().returns({
                    // listMetricsStub = sinon.stub().returns({
                    eachPage: (cb) => {
                        cb(null, scenario.metrics)

                        cb(null, null) // no more pages
                    }
                })
                // sinon.stub(awsSdk, 'CloudWatch').returns({
                sandbox.stub(awsSdk, 'CloudWatch').returns({
                    listMetrics: listMetricsStub,
                    putDashboard: putDashboardSpy
                });

                awsSdk.config.region = 'ap-southeast-2';
            })

            afterEach(() => {
                // awsSdk.CloudWatch.restore();
                sandbox.restore();
            })

            it("should generate a dashboard", () => {
                return LambdaTester(index.generateDashboardTrend)
                    .event(scenario.event)
                    .expectResult((result, additional) => {
                        expect(putDashboardSpy).to.have.callCount(1);
                    });
            })

            it('should generate 5 text widgets - to explain each metric + interpretation', () => {
                return LambdaTester(index.generateDashboardTrend)
                    .event(scenario.event)
                    .expectResult((result, additional) => {
                        const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                        const textWidgets = dashboard.widgets.filter(w => w.type === 'text');

                        expect(textWidgets.length).to.equal(5);

                    });
            })

            if (scenario.expectTruncated) {
                describe('When there are too many pipelines in the account', () => {
                    it('should report a maximum of 31 pipelines in the dashboard', () => {
                        const consoleSpy = sandbox.spy(console, 'warn')
                        return LambdaTester(index.generateDashboardTrend)
                            .event(scenario.event)
                            .expectResult((result, additional) => {
                                expect(consoleSpy).to.have.been.calledWith("Maximum of 31 allowed in a single dashboard.  Some pipelines will not be reported.");
                            });
                    })
                    it('should log a warning when pipelines will not be reported', () => {
                        const consoleSpy = sandbox.spy(console, 'warn')
                        return LambdaTester(index.generateDashboardTrend)
                            .event(scenario.event)
                            .expectResult((result, additional) => {
                                expect(consoleSpy).to.have.been.calledWith("Maximum of 31 allowed in a single dashboard.  Some pipelines will not be reported.");
                            });
                    })
                })
            } else {
                const widgetsPerPipeline = 4;
                it(`should generate ${widgetsPerPipeline} dashboards per pipeline`, () => {

                    return LambdaTester(index.generateDashboardTrend)
                        .event(scenario.event)
                        .expectResult((result, additional) => {
                            const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                            const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');

                            expect(metricWidgets.length).to.equal(widgetsPerPipeline * scenario.uniquePipelines);

                        });


                });

                it('should reference the PipelineName in the metrics for each widget', () => {
                    return LambdaTester(index.generateDashboardTrend)
                        .event(scenario.event)
                        .expectResult((result, additional) => {
                            const dashboard = JSON.parse(putDashboardSpy.getCall(0).args[0].DashboardBody);
                            const metricWidgets = dashboard.widgets.filter(w => w.type === 'metric');

                            const pipelineNames = [...new Set(scenario.metrics.Metrics.map(m => m.Dimensions[0].Value))];
                            
                            pipelineNames.forEach((name, idx) => {
                                const startIdx = idx*widgetsPerPipeline;
                                const widgetsForPipeline = metricWidgets.slice(startIdx, startIdx+widgetsPerPipeline);

                                widgetsForPipeline.forEach(widget => {

                                    expect(JSON.stringify(widget.properties.metrics)).to.contain(name)
                                }) 
                            })
                            console.log(pipelineNames)

                        });
                })
            }
        })
    })

})

