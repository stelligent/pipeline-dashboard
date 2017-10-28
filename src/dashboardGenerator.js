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
                                "stat": "Sum",
                                "period": 2592000
                            }],
                            [".", "FailureCount", ".", ".", {"stat": "Sum", "period": 2592000}],
                            [".", "CycleTime", ".", ".", {"period": 2592000, "color": "#9467bd"}],
                            [".", "RedTime", ".", ".", {
                                "stat": "Sum",
                                "period": 2592000,
                                "yAxis": "left",
                                "color": "#d62728"
                            }],
                            [".", "GreenTime", ".", ".", {"period": 2592000, "stat": "Sum", "color": "#2ca02c"}]
                        ],
                        "region": state.region,
                        "title": pipelineName,
                        "period": 300
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
                "markdown": "\nAll metrics are calculated over the past 30 days\n\n* **SuccessCount** - count of all successful pipeline executions\n* **FailureCount** - count of all failed pipeline executions\n* **CycleTime** - average pipeline time for successful executions\n* **RedTime** - sum of all time spent with a red pipeline\n* **GreenTime** - sum of all time spent with a green pipeline\n"
            }
        });

        return state.cloudwatch.putDashboard({
            'DashboardName': 'Pipelines-'+state.region,
            'DashboardBody': JSON.stringify(dashboard)
        }).promise();
    }
}

module.exports = DashboardGenerator;
