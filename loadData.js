'use strict';

const COUNT = 'Count';
const SECONDS = 'Seconds';

const AWS = require('aws-sdk');
if(!AWS.config.region) {
    AWS.config.region = process.env.AWS_REGION;
}

let cloudwatch = new AWS.CloudWatch();
function putMetric(pipelineName, eventTime, metricName, unit, value) {
    let data = {
        'Timestamp': eventTime,
        'MetricName': metricName,
        'Unit': unit,
        'Value': value,
        'Dimensions': [{
            'Name': 'PipelineName',
            'Value': pipelineName,
        }],
    };

    console.log(data);

    return cloudwatch.putMetricData({
        Namespace: 'Pipeline',
        MetricData: [ data ]
    }).promise();
}


[
    {
        'name': 'Hooli',
        'events': [
            {
                'waitTime': 900,
                'runTime': 300,
                'succeeded': true,
            },
            {
                'waitTime': 900,
                'runTime': 100,
                'succeeded': false,
            },
            {
                'waitTime': 200,
                'runTime': 300,
                'succeeded': true,
            },
            {
                'waitTime': 200,
                'runTime': 300,
                'succeeded': true,
            },
        ]
    },
    {
        'name': 'Acme',
        'events': [
            {
                'waitTime': 1200,
                'runTime': 800,
                'succeeded': true,
            },
            {
                'waitTime': 86400,
                'runTime': 200,
                'succeeded': false,
            },
            {
                'waitTime': 20000,
                'runTime': 350,
                'succeeded': true,
            },
            {
                'waitTime': 86000,
                'runTime': 400,
                'succeeded': true,
            },
            {
                'waitTime': 350,
                'runTime': 1350,
                'succeeded': true,
            },
            {
                'waitTime': 10000,
                'runTime': 400,
                'succeeded': true,
            },
        ]
    },
    {
        'name': 'Bananas',
        'events': [
            {
                'waitTime': 1200,
                'runTime': 1800,
                'succeeded': true,
            },
            {
                'waitTime': 700,
                'runTime': 200,
                'succeeded': false,
            },
            {
                'waitTime': 350,
                'runTime': 350,
                'succeeded': false,
            },
            {
                'waitTime': 1200,
                'runTime': 1800,
                'succeeded': true,
            },
            {
                'waitTime': 10000,
                'runTime': 400,
                'succeeded': false,
            },
            {
                'waitTime': 1200,
                'runTime': 1800,
                'succeeded': true,
            },
            {
                'waitTime': 10000,
                'runTime': 400,
                'succeeded': false,
            },
            {
                'waitTime': 10000,
                'runTime': 400,
                'succeeded': false,
            },
            {
                'waitTime': 1200,
                'runTime': 1800,
                'succeeded': true,
            },
        ]
    },
].forEach(p => {
    let startDate = new Date(new Date() - (60 * 60 * 96 * 1000)); // 96 hours ago
    let priorEvent = {
        startTimestamp:  startDate,
        endTimestamp:  new Date(startDate.getTime() + (300 * 1000)),
        waitTime: 0,
        runTime: 300,
    };
    let priorSuccessEvent = priorEvent;
    p.events.forEach(e => {
        e.startTimestamp = priorEvent.endTimestamp;
        e.endTimestamp = new Date(priorEvent.endTimestamp.getTime() + ((e.waitTime + e.runTime) * 1000));
        let eventTime = e.endTimestamp;

        if (e.succeeded) {
            putMetric(p.name, eventTime, 'SuccessCount', COUNT, 1);
            putMetric(p.name, eventTime, 'SuccessLeadTime', SECONDS, e.runTime);
            putMetric(p.name, eventTime, 'SuccessCycleTime', SECONDS, durationInSeconds(priorSuccessEvent.endTimestamp, e.endTimestamp));
            putMetric(p.name, eventTime, 'DeliveryLeadTime', SECONDS, durationInSeconds(priorSuccessEvent.endTimestamp, e.endTimestamp) - e.waitTime);

            if(!priorEvent.succeeded) {
                putMetric(p.name, eventTime, 'RedTime', SECONDS, durationInSeconds(priorEvent.startTimestamp, e.startTimestamp));
            }

            priorSuccessEvent = e;
        } else {
            putMetric(p.name, eventTime, 'FailureCount', COUNT, 1);
            putMetric(p.name, eventTime, 'FailureLeadTime', SECONDS, e.runTime);

            if(priorEvent.succeeded) {
                putMetric(p.name, eventTime, 'GreenTime', SECONDS, durationInSeconds(priorEvent.startTimestamp, e.startTimestamp)+e.waitTime-priorEvent.waitTime);
            }
        }

        priorEvent = e;
    })

});

function durationInSeconds(t1, t2) {
    return Math.round((t2.getTime() - t1.getTime()) / 1000);
}

