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
                    "width": 21,
                    "height": 3,
                    "properties": {
                        "view": "singleValue",
                        "metrics": [
                            ["Pipeline", "SuccessCycleTime", "PipelineName", pipelineName, {
                                "label": "Cycle Time",
                                "stat": "Average",
                                "color": "#212ebd"
                            }],
                            [".", "DeliveryLeadTime", ".", ".", {
                                "label": "Lead Time",
                                "stat": "Average",
                                "color": "#d6721b"
                            }],
                            [".", "GreenTime", ".", ".", {
                                "label": "MTBF",
                                "stat": "Average",
                                "color": "#2ca02c"
                            }],
                            [".", "RedTime", ".", ".", {
                                "label": "MTTR",
                                "stat": "Average",
                                "color": "#d62728"
                            }],
                            [".", "FailureLeadTime", ".", ".", {
                                "label": "Feedback Time",
                                "stat": "Average",
                                "color": "#a02899"
                            }],
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
                "title": "Cycle Time",
                "description": "mean time between successful pipeline executions"
            },
            {
                "title": "Lead Time",
                "description": "mean lead time from commit to production, including rework"
            },
            {
                "title": "MTBF",
                "description": "mean time between pipeline failures"
            },
            {
                "title": "MTTR",
                "description": "mean time to pipeline recovery"
            },
            {
                "title": "Feedback Time",
                "description": "mean lead time for failed pipeline executions"
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
