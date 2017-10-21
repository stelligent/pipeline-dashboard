# Overview
Simple dashboard built for viewing pipeline metrics in AWS.  Built using CloudWatch dashboards and metrics populated from CloudWatch events that CodePipeline triggers.

**Launch now!**

| us-east-1 | us-west-2 |
| --------- | --------- |
| [![Launch](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/new?stackName=pipeline-dashboard&templateURL=https://s3.amazonaws.com/pipeline-dashboard-us-east-1/template.yml) | [![Launch](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home?region=us-west-2#/stacks/new?stackName=pipeline-dashboard&templateURL=https://s3-us-west-2.amazonaws.com/pipeline-dashboard-us-west-2/template.yml) |

As seen in the diagram below, a Lambda function is triggered from a CloudWatch Event rule for CodePipeline events.  The Lambda function then generates CloudWatch metrics.  The CloudWatch dashboard is then build from the metrics that the Lambda function created.
![Metric Diagram](docs/pipeline-dashboard.png)

The list of pipelines in the dashboard cannot be generated dyanmically so another Lambda function runs regulary to regenerate the dashboard based on whatever metrics have been created.
![Dashboard Builder Diagram](docs/pipeline-dashboard-builder.png)

# Sample Dashboard

![Screen Shot](docs/screen-shot.png)

# Development

To run the unit tests: `npm test`

To stage the lambda code and CloudFormation template: `npm run stage`
You can change the region via `npm config set pipeline-dashboard:region us-west-2`

To deploy to your account: `npm run deploy`
You can change the bucket via `npm config set pipeline-dashboard:staging_bucket my-bucket-name`

