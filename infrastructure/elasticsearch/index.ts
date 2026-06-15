// import * as k8s from '@pulumi/kubernetes';
import { EckOperator } from './operator';
import { ELK } from './elk';

const operator = new EckOperator('eck-operator');
new ELK('default', { dependsOn: operator.chart });
