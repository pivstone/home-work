import * as k8s from '@pulumi/kubernetes';

const ns = new k8s.core.v1.Namespace('monitoring', {
  metadata: { name: 'monitoring' },
});

new k8s.helm.v4.Chart(
  'prometheus-stack',
  {
    repositoryOpts: {
      repo: 'https://prometheus-community.github.io/helm-charts',
    },
    namespace: ns.metadata.name,
    chart: 'kube-prometheus-stack',
    version: '86.2.3',
    values: {
      prometheusOperator: {
        tls: {
          enabled: false,
        },
        admissionWebhooks: {
          enabled: false,
        },
      },
    },
  },
  { dependsOn: ns },
);
