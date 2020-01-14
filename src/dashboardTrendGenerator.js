'use strict';


const ANNOTATION_ELITE_COLOUR = '#98df8a';
const ANNOTATION_HIGH_COLOUR = '#dbdb8d';
const MEAN_COLOUR = '#2ca02c';

const WIDGET_HEIGHT = 6;
const WIDGET_WIDTH = 12;


// Create a dashboard containing multiple widgets, each based from a consistent template
// The properties here map the metrics to a readable label
// unit conversion is used to convert from seconds to a more meaningful unit, based on the metric.
const MINUTES = {
    unit: 60,
    label: 'minutes'
};

const HOURS = {
    unit: 60 * 60,
    label: 'hours'
};

const DAYS = {
    unit: 60 * 60 * 24,
    label: 'days'
};

const THIRTY_DAYS = 60 * 60 * 24 * 30;

const applyLimits = (state) => {
    // See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_limits.html
    const maxMetricsPerDash = 500;
    const metricsPerWidget = 4;
    const widgetsPerPipeline = 4;
    const maxPipelines = Math.floor(maxMetricsPerDash / (metricsPerWidget * widgetsPerPipeline));

    if (state.pipelineNames.length > maxPipelines) {
        console.warn(`Maximum of ${maxPipelines} allowed in a single dashboard.  Some pipelines will not be reported.`);
    }
    state.pipelineNames = state.pipelineNames.slice(0, maxPipelines);
};

function deploymentFrequencyWidget(pipelineName, y, state) {
    const y_offset = 0;
    return {
        "type": "metric",
        "x": 0,
        "y": y + y_offset,
        "width": WIDGET_WIDTH,
        "height": WIDGET_HEIGHT,
        "properties": {
            "metrics": [
                [{ "expression": "FILL(m2,0)", "id": "e2", "period": DAYS.unit, "region": state.region, "yAxis": "left", "color": "#ff7f0e", "label": "Deployment Frequency" }],
                [{ "expression": `m6/PERIOD(m6) * ${DAYS.unit}`, "label": "Average (30d)", "id": "e1", "color": MEAN_COLOUR }],
                ["Pipeline", "SuccessCount", "PipelineName", pipelineName, { "period": DAYS.unit, "stat": "Sum", "id": "m2", "visible": false, "label": "Deployments" }],
                ["...", { "period": THIRTY_DAYS, "stat": "Sum", "id": "m6", "label": "Deployment Freq (30d)", "visible": false }]
            ],
            "view": "timeSeries",
            "region": state.region,
            "title": `${pipelineName} Frequency`,
            "period": THIRTY_DAYS,
            "stacked": false,
            "yAxis": {
                "left": {
                    "label": "deployments / day",
                    "showUnits": false,
                    "min": 0
                },
                "right": {
                    "showUnits": true
                }
            },
            "annotations": {
                "horizontal": [
                    {
                        "color": ANNOTATION_ELITE_COLOUR,
                        "label": "daily",
                        "value": 1,
                        "fill": "above"
                    },
                    [
                        {
                            "color": ANNOTATION_HIGH_COLOUR,
                            "label": "multiple per week",
                            "value": 0.25
                        },
                        {
                            "value": 1,
                            "label": "daily"
                        }
                    ]
                ]
            }
        }
    };
}

function otherWidgets(pipelineName, y, state) {

    return state.widgetMappings.map(mapping => {
        const region = state.region;
        const unitConversion = mapping.unitConversion.unit;
        const label = mapping.label;

        return {
            "type": "metric",
            "x": mapping.x,
            "y": y + mapping.y_offset,
            "width": WIDGET_WIDTH,
            "height": WIDGET_HEIGHT,
            "properties": {
                "metrics": [
                    [{ "expression": `m1/${unitConversion}`, "label": `${label}`, "id": "e2", "period": DAYS.unit, "region": region, "yAxis": "left", "color": "#ff7f0e" }],
                    [{ "expression": `FILL(m4,AVG(m4))/${unitConversion}`, "label": `${label} (30d - p90)`, "id": "e3", "region": region, "yAxis": "left", "color": "#1f77b4" }],
                    [{ "expression": `FILL(m5,AVG(m5))/${unitConversion}`, "label": `${label} (30d - p10)`, "id": "e4", "region": region, "yAxis": "left", "color": "#1f77b4" }],
                    [{ "expression": `FILL(m3,AVG(m3))/${unitConversion}`, "label": `${label} (30d - p50)`, "id": "e5", "region": region, "color": MEAN_COLOUR }],
                    ["Pipeline", mapping.metric, "PipelineName", pipelineName, { "label": `${label}`, "stat": "Average", "color": "#1f77b4", "period": DAYS.unit, "id": "m1", "visible": false }],
                    ["...", { "stat": "Average", "period": THIRTY_DAYS, "id": "m3", "label": `${label} (30d)`, "visible": false }],
                    ["...", { "stat": "p90", "period": THIRTY_DAYS, "id": "m4", "visible": false, "label": `${label} (p90)` }],
                    ["...", { "stat": "p10", "period": THIRTY_DAYS, "id": "m5", "visible": false, "label": `${label} (p10)` }]
                ],
                "view": "timeSeries",
                "region": region,
                "title": `${pipelineName} ${label}`,
                "period": THIRTY_DAYS,
                "stacked": false,
                "yAxis": {
                    "left": {
                        "min": 0,
                        "label": mapping.unitConversion.label,
                        "showUnits": false
                    },
                    "right": {
                        "showUnits": true
                    }
                },
                "annotations": mapping.annotations
            }
        };
    });

}

class DashboardTrendGenerator {
    run(eventPromise) {
        return eventPromise
            .then(this.initializeState)
            .then(this.getPipelines)
            .then(this.putDashboard);
    }


    initializeState(state) {
        state.pipelineNames = [];

        state.widgetMappings = [
            {
                x: 0 + WIDGET_WIDTH,
                y_offset: 0,
                label: "Lead Time",
                metric: "DeliveryLeadTime",
                unitConversion: MINUTES,
                annotations: {
                    "horizontal": [
                        {
                            "color": ANNOTATION_ELITE_COLOUR,
                            "label": "< 1 hour",
                            "value": 60,
                            "fill": "below"
                        },
                        [
                            {
                                "color": ANNOTATION_HIGH_COLOUR,
                                "value": 60,
                                "label": "1 hour"
                            },
                            {
                                "label": "< 0.5 day",
                                "value": 60 * 12
                            },
                        ]
                    ]
                }
            },
            {
                x: 0,
                y_offset: 0 + WIDGET_HEIGHT,
                label: "MTBF",
                metric: "GreenTime",
                unitConversion: DAYS
            },
            {
                x: 0 + WIDGET_WIDTH,
                y_offset: 0 + WIDGET_HEIGHT,
                label: "MTTR",
                metric: "RedTime",
                unitConversion: HOURS
            },
        ];

        return state;
    }

    getPipelines(state) {
        return new Promise(function (resolve, reject) {
            state.cloudwatch.listMetrics({ "Namespace": "Pipeline" }).eachPage(function (err, data) {
                if (err) {
                    reject(err);
                    return;
                }

                if (data === null) {
                    resolve(state);
                } else {
                    state.pipelineNames =
                        data.Metrics.map(m => m.Dimensions.filter(d => d.Name === 'PipelineName').map(d => d.Value))
                            .reduce((a, b) => a.concat(b), state.pipelineNames);
                }
            });

        });
    }


    putDashboard(state) {
        state.pipelineNames = [...new Set(state.pipelineNames)].sort();
        let y = 0; // leave space for the legend on first row
        let period = 60 * 60 * 24 * 30;

        applyLimits(state);

        let dashboard = {
            "start": "-P42D",
            "widgets": [],
        };

        const TEXT_HEIGHT = 4;
        let x = 0;
        [
            {
                "title": "Deployment Frequency",
                "description":
                    "How often code is deployed **to production**.  **Higher = better**.\n\n" +
                    "Deploying changes more frequently, in smaller increments, correlates with success.\n\n" +
                    "Elite performers deploy multiple times per day."
            },
            {
                "title": "Lead Time",
                "description":
                    "Time from code commit to running in production, including rework.  **Lower = better**.\n\n" +
                    "Reducing lead times reduces cost to value, and improves agility.\n\n" +
                    "Elite performers have lead times less than 1 day."
            },
            {
                "title": "MTBF",
                "description":
                    "Mean time between pipeline failures.  **Higher = better**\n\n" +
                    "A stable pipeline improves *Lead Time* and *Deployment Frequency*.\n\n" +
                    "And unstable pipeline suggests systemic quality issues that need to be addressed."
            },
            {
                "title": "MTTR",
                "description":
                    "Mean time to fix a failing pipeline.  **Lower = better**\n\n" +
                    "High MTTR negatively effects *Lead Time* and *Deployment Frequency*.\n\n" +
                    'When the pipeline fails, the team should "stop the line" and swarm to fix it.'
            },
            {
                "title": "Interpreting the Graphs",
                "description":
                    "Each metric is graphed on a daily basis.  There may be gaps in the data if the pipeline did not run.\n\n" +
                    "Charts show the 30-day trend, with p10,p50 and p90 trends. " +
                    "A wide range between p10 + p90 indicates a large variation and outliers. " +
                    "This indicates the metric is uncontrolled.  Work to narrow the variance for improved consistency.\n\n" +
                    "Graphs with annotations show performance in relation to the DORA State of DevOps report.  " +
                    "The green area indicates elite performers; yellow high performers",
                "y": 8
            }
        ].forEach(l => {
            dashboard.widgets.push({
                "type": "text",
                "x": x,
                "y": y,
                "width": l.y ? l.y : 4,
                "height": TEXT_HEIGHT,
                "properties": {
                    "markdown": `### ${l.title}\n${l.description}`
                }
            });

            x += 4;
        });
        y += TEXT_HEIGHT;

        let pipelineWidgets = state.pipelineNames.map(pipelineName => {
            let widget = [deploymentFrequencyWidget(pipelineName, y, state)].concat(otherWidgets(pipelineName, y, state));
            y += 2 * WIDGET_HEIGHT;
            return widget;
        });

        // flatten the nested arrays
        dashboard.widgets = [].concat.apply(dashboard.widgets, pipelineWidgets);

        return state.cloudwatch.putDashboard({
            'DashboardName': 'PipelineTrends-' + state.region,
            'DashboardBody': JSON.stringify(dashboard)
        }).promise();
    }
}

module.exports = DashboardTrendGenerator;
