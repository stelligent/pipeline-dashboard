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
        let y=0;
        let period=60 * 60 * 24 * 30;
        let dashboard = {
            "widgets": state.pipelineNames.map(pipelineName => {
                return {
                    "type": "metric",
                    "x": 0,
                    "y": (y += 3),
                    "width": 18,
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

        dashboard.widgets.push({
            "type": "text",
            "x": 18,
            "y": 0,
            "width": 6,
            "height": 6,
            "properties": {
                "markdown": `
# Metric Details
* **Success Count** - count of successful pipeline executions
* **Failure Count** - count of failed pipeline executions
* **Cycle Time** - average pipeline runtime for successful executions
* **MTTR** - Mean time to pipeline recovery
* **MTBF** - Mean time between pipeline failures
`
            }
        });

        return state.cloudwatch.putDashboard({
            'DashboardName': 'Pipelines-'+state.region,
            'DashboardBody': JSON.stringify(dashboard)
        }).promise();
    }
}

module.exports = DashboardGenerator;
