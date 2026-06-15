// import * as k8s from '@pulumi/kubernetes';
import { EckOperator } from './operator';
import { ElasticStack } from './elasticstack';

const operator = new EckOperator('eck-operator');
new ElasticStack('monitor', { dependsOn: operator.ready });
