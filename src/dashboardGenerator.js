'use strict';


class DashboardGenerator {
    run(eventPromise) {
        return eventPromise
            .then(this.initializeState)
            .then(this.getPipelines)
            .then(this.putDashboard);
    }

    initializeState(state) {
        state.pipelineNames = [];
        return state;
    }

    getPipelines(state) {
        return new Promise( function(resolve, reject) {
            state.cloudwatch.listMetrics({"Namespace": "Pipeline"}).eachPage(function(err, data) {
                if(err) {
                    reject(err);
                    return;
                }

                if(data === null) {
                    resolve(state);
                } else {
                    state.pipelineNames =
                        data.Metrics.map(m => m.Dimensions.filter(d => d.Name === 'PipelineName').map(d => d.Value))
                            .reduce((a,b) => a.concat(b), state.pipelineNames);
                }
            });
        });
    }

    putDashboard(state) {
        state.pipelineNames = [...new Set(state.pipelineNames)].sort();
        let y=0; // leave space for the legend on first row
        let period=60 * 60 * 24 * 30;
        let dashboard = {
            "widgets": state.pipelineNames.map(pipelineName => {
                return {
                    "type": "metric",
                    "x": 0,
                    "y": (y += 3),
                    "width": 24,
                    "height": 3,
                    "properties": {
                        "view": "singleValue",
                        "metrics": [
                            ["Pipeline", "SuccessCount", "PipelineName", pipelineName, {
                                "label": "Success Count",
                                "stat": "Sum",
                                "color": "#2ca02c"
                            }],
                            [".", "FailureCount", ".", ".", {
                                "label": "Failure Count",
                                "stat": "Sum",
                                "color": "#d62728"
                            }],
                            [".", "CycleTime", ".", ".", {
                                "label": "Cycle Time",
                                "stat": "Average",
                                "color": "#212ebd"
                            }],
                            [".", "RedTime", ".", ".", {
                                "label": "MTTR",
                                "stat": "Average",
                                "color": "#d6721b"
                            }],
                            [".", "GreenTime", ".", ".", {
                                "label": "MTBF",
                                "stat": "Average",
                                "color": "#a02899"
                            }]
                        ],
                        "region": state.region,
                        "title": pipelineName,
                        "period": period
                    }
                };
            })
        };


        let x = 0;
        [
            {
                "title": "Success Count",
                "description": "count of successful pipeline executions"
            },
            {
                "title": "Failure Count",
                "description": "count of failed pipeline executions"
            },
            {
                "title": "Cycle Time",
                "description": "mean runtime for successful executions"
            },
            {
                "title": "MTTR",
                "description": "mean time to pipeline recovery"
            },
            {
                "title": "MTBF",
                "description": "mean time between pipeline failures"
            },
        ].forEach(l => {
            dashboard.widgets.push({
                "type": "text",
                "x": x,
                "y": y,
                "width": 4,
                "height": 2,
                "properties": {
                    "markdown": `### ${l.title}\n${l.description}`
                }
            });

            x += 4;
        });

        return state.cloudwatch.putDashboard({
            'DashboardName': 'Pipelines-'+state.region,
            'DashboardBody': JSON.stringify(dashboard)
        }).promise();
    }
}

module.exports = DashboardGenerator;
