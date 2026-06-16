import * as k8s from '@pulumi/kubernetes';
import * as fs from 'node:fs';

const APP_NAME = 'demo';
const appLabels = { app: APP_NAME };

const FILENAME = 'default.conf.conf';
const PORT = 80;

const configMap = new k8s.core.v1.ConfigMap('code', {
  data: { [FILENAME]: fs.readFileSync(FILENAME).toString() },
});

const configName = configMap.metadata.apply((m) => m.name);

const deployment = new k8s.apps.v1.Deployment(
  'demo',
  {
    spec: {
      selector: { matchLabels: appLabels },
      replicas: 2,
      template: {
        metadata: { labels: appLabels },
        spec: {
          containers: [
            {
              name: 'nginx',
              image: 'nginx',
              volumeMounts: [
                { name: 'nginx-config', mountPath: '/etc/nginx/templates/' },
              ],
              env: [
                { name: 'NGINX_ENVSUBST_TEMPLATE_SUFFIX', value: '.conf' },
                {
                  name: 'POD_IP',
                  valueFrom: {
                    fieldRef: {
                      fieldPath: 'status.podIP',
                    },
                  },
                },
              ],
            },
          ],
          volumes: [{ name: 'nginx-config', configMap: { name: configName } }],
        },
      },
    },
  },
  { dependsOn: configMap },
);

const svc = new k8s.core.v1.Service(
  `${APP_NAME}-svc`,
  {
    metadata: { labels: deployment.spec.template.metadata.labels },
    spec: {
      type: 'NodePort',
      ports: [
        { port: PORT, targetPort: PORT, nodePort: 30080, protocol: 'TCP' },
      ],
      selector: appLabels,
    },
  },
  { dependsOn: deployment },
);

svc.metadata.apply((m) => m.name);

export const name = deployment.metadata.name;
