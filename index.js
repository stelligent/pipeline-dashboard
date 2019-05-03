'use strict';
const DashboardGenerator = require('./src/dashboardGenerator');
const DashboardTrendGenerator = require('./src/dashboardTrendGenerator');
const PipelineEventHandler = require('./src/pipelineEventHandler');

const AWS = require('aws-sdk');
if(!AWS.config.region) {
    AWS.config.region = process.env.AWS_DEFAULT_REGION;
}

exports.handlePipelineEvent = (event, context, callback) => {

    let statePromise = Promise.resolve({
        event: event,
        cloudwatch: new AWS.CloudWatch(),
        codepipeline: new AWS.CodePipeline()
    });

    new PipelineEventHandler()
        .run(statePromise)
        .then(() => callback())
        .catch(callback);
};

exports.generateDashboard = (event, context, callback) => {
    let statePromise = Promise.resolve({
        event: event,
        region: AWS.config.region,
        cloudwatch: new AWS.CloudWatch()
    });

    new DashboardGenerator()
        .run(statePromise)
        .then(() => callback())
        .catch(callback);
};

exports.generateDashboardTrend = (event, context, callback) => {
    let statePromise = Promise.resolve({
        event: event,
        region: AWS.config.region,
        cloudwatch: new AWS.CloudWatch()
    });

    new DashboardTrendGenerator()
        .run(statePromise)
        .then(() => callback())
        .catch(callback);
};

