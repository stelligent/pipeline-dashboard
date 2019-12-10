# Overview
Simple dashboard built for viewing pipeline metrics in AWS.  Built using CloudWatch dashboards and metrics populated from CloudWatch events that CodePipeline triggers. You can also deploy this dashboard directly from the AWS Serverless Application Repository [here](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:611781478414:applications~mechanicalrock-pipeline-dashboard).

This is a fork of the Stelligent Pipeline Dashboard.  For more details, see the original blog post [CodePipeline Dashboard](https://stelligent.com/2017/11/16/codepipeline-dashboard/).

![Screen Shot](docs/screen-shot.png)

## Pipeline Trends

Whilst the metrics themselves provide insight as to the current health of a project, by looking at trends over time you can use a data driven approach to your process improvement.  If we implement continuous deployment, Cycle Time should improve.
The [State of DevOps](https://services.google.com/fh/files/misc/state-of-devops-2019.pdf) report defines 4 key metrics:

| Metric | Definition  |
| -------| ----------- |
| `Lead Time for changes` | For the primary application or service you work on, what is your lead time for changes (i.e., how long does it take to go from code committed to code successfully running in production)? |
| `Deployment Frequency`  | For the primary application or service you work on, how often does your organization deploy code to production or release it to end users? |
| `Time to Restore Service` | For the primary application or service you work on, how long does it generally take to restore service when a service incident or a defect that impacts users occurs (e.g., unplanned outage or service impairment)? |
| `Change Failure Rate` | For the primary application or service you work on, what percentage of changes to production or released to users result in degraded service (e.g., lead to service impairment or service outage) and subsequently require remediation (e.g., require a hotfix, rollback, fix forward, patch)? |

Lead Time and Deployment Frequency can be measured using the pipeline, to assess Software Delivery and Operational Performance against industry benchmarks.

Mean Time To Recovery is not a direct correlation for a pipeline, since failures in the pipeline never make it to production, which is a good thing!  Similarly, depending on your pipeline, Change Failure Rate similarly cannot be directly measured, unless your pipeline includes staged deployment, such as Blue/Green or Canary deployments.

![Screen Shot](docs/screenshot-trend.png)


## Launch now!

Use the **Serverless Application Repository** to deploy in your account: [Deploy Now](https://serverlessrepo.aws.amazon.com/applications/arn:aws:serverlessrepo:us-east-1:611781478414:applications~mechanicalrock-pipeline-dashboard)

# Architecture

As seen in the diagram below, a Lambda function is triggered from a CloudWatch Event rule for CodePipeline events.  The Lambda function then generates CloudWatch metrics.  The CloudWatch dashboard is then build from the metrics that the Lambda function created.
![Metric Diagram](docs/pipeline-dashboard.png)

The list of pipelines in the dashboard cannot be generated dyanmically so another Lambda function runs regulary to regenerate the dashboard based on whatever metrics have been created.
![Dashboard Builder Diagram](docs/pipeline-dashboard-builder.png)


# Metric Details

![Fail 1](docs/pipeline-dashboard-fail-1.png)

| Metric | Description | How to Calculate | How to Interpret |
| -------| ----------- | ---------------- | ---------------- |
| `Cycle Time` | How often software is being delivered to production.  | The mean interval of time between two consecutive successful pipeline executions. | If this number is less than `Lead Time` then many commits are being delivered to the pipeline before a previous commit is complete.  If this number is significantly greater than `Lead Time` then the pipeline is delivering risky deployments due to the large batch size of the commits. |
| `Lead Time` | How long it takes for a change to go to production.  | The mean amount of time from commit to production, including rework. | This is the number the business cares about most, as it represents how long it takes for a feature to get into the hands of the customer.  If this number is too large, look at improving the availability of the pipeline `(MTBF / MTBF + MTTR)`. |
| `MTBF` | How often does the pipeline fail.  | The mean interval of time between the start of a successful pipeline execution and the start of a failed pipeline execution.| This number should be high in comparison to `MTTR`.  If this number is low, then consider improving the reliability of the pipeline by first researching if the root cause is the quality of new code being committed, or the repeatability of the infrastructure and test automation. |
| `MTTR` | How long does it take to fix the pipeline.  | The mean interval of time between the start of a failed pipeline execution and the start of a successful pipeline execution.| This number should be low as it is a measure of a team's ability to "stop the line" when a build fails and swarm on resolving it. If the `Feedback Time` is high, then consider addressing that, otherwise the issue is with the team's responsiveness to failures.|
| `Feedback Time` | How quick can we identify failures.  | The mean amount of time from commit to failure of a pipeline execution.  | This number should be low as it affect `MTTR`.  Ideally, failures would be detected as quick as possible in the pipeline, rather than finding them farther along in the pipeline.  |

## Cycle Time vs. Lead Time
`Cycle Time` and `Lead Time` are frequently confused.  For a good explanation, please see [Continuous Delivery: lead time and cycle time](http://www.caroli.org/continuous-delivery-lead-time-and-cycle-time/).  To compare the two metrics consider the following scenarios.  Notice that `Lead Time` is the same for the pipelines in both scenarios, however the cycle time is much smaller in the second scenario due to the fact that the pipelines are running in parallel (higher `WIP`).  This agrees with the formula `Lead Time = WIP x Cycle Time`:

![Success 1](docs/pipeline-dashboard-success-1.png)
*Fig.1 - Pipelines in series*

![Success 2](docs/pipeline-dashboard-success-2.png)
*Fig.2 - Pipelines in parallel*

# Development

To run the unit tests: `npm test`

To deploy the CodeBuild project for staging the templates: `npm run create-codebuild` or `npm run update-codebuild`

To deploy to your account: `npm run deploy`
You can change the bucket via `npm config set pipeline-dashboard:staging_bucket my-bucket-name`


# Release

To Release:
1. Push your changes.
2. Run the codebuild project in ap-southeast-2 to build the package
3. Look in S3 at the updated template `https://mr-pipeline-dashboard-sar-ap-southeast-2.s3-ap-southeast-2.amazonaws.com/template.yml`
4. Update `template-sar.yml` with the updated codeuri references
5. Release the SAR in us-east-1

# TODO

* Review `pipline.yml` and deploy?