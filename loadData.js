'use strict';

const COUNT = 'Count';
const SECONDS = 'Seconds';

const AWS = require('aws-sdk');
if(!AWS.config.region) {
    AWS.config.region = process.env.AWS_REGION;
}

let cloudwatch = new AWS.CloudWatch();
function putMetric(pipelineName, eventTime, metricName, unit, value) {
    return cloudwatch.putMetricData({
        Namespace: 'Pipeline',
        MetricData: [
            {
                'Timestamp': eventTime,
                'MetricName': metricName,
                'Unit': unit,
                'Value': value,
                'Dimensions': [{
                    'Name': 'PipelineName',
                    'Value': pipelineName,
                }],
            }
        ]
    }).promise();
}


[{
    'name': 'test',
    'events': [
        {
            'waitTime': 900,
            'cycleTime': 300,
            'succeeded': true,
        },
        {
            'waitTime': 900,
            'cycleTime': 100,
            'succeeded': false,
        },
        {
            'waitTime': 200,
            'cycleTime': 300,
            'succeeded': true,
        },
    ]
}].forEach(p => {
    let priorEventTime = new Date();
    let priorSucceeded = false;
    p.events.forEach(e => {
        let eventTime = new Date(priorEventTime.getTime() + ((e.waitTime + e.cycleTime) * 1000));

        if (e.succeeded) {
            putMetric(p.name, eventTime, 'SuccessCount', COUNT, 1);
            putMetric(p.name, eventTime, 'CycleTime', SECONDS, e.cycleTime);

            if(!priorSucceeded) {
                putMetric(p.name, eventTime, 'RedTime', SECONDS, e.waitTime);
            }
        } else {
            putMetric(p.name, eventTime, 'FailureCount', COUNT, 1);

            if(priorSucceeded) {
                putMetric(p.name, eventTime, 'GreenTime', SECONDS, e.waitTime);
            }
        }

        priorEventTime = eventTime;
        priorSucceeded = e.succeeded;
    })

});

