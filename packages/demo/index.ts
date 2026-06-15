import * as k8s from '@pulumi/kubernetes';
import * as fs from 'node:fs';
import * as path from 'node:path';

const APP_NAME = 'demo';
const appLabels = { app: APP_NAME };

const WORKING_DIR = '/opt/app';
const FILENAME = 'server.js';
const PORT = 3000;

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
              name: 'demo',
              image: 'node:22-alpine',
              workingDir: WORKING_DIR,
              command: ['node', 'server.js'],
              volumeMounts: [{ name: 'code', mountPath: WORKING_DIR }],
              env: [
                {
                  name: 'HTTP_PORT',
                  value: PORT.toString(),
                },

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
          volumes: [{ name: 'code', configMap: { name: configName } }],
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
      type: 'ClusterIP',
      ports: [{ port: PORT, targetPort: PORT, protocol: 'TCP' }],
      selector: appLabels,
    },
  },
  { dependsOn: deployment },
);

const svc_name = svc.metadata.apply((m) => m.name);

new k8s.networking.v1.Ingress(
  'demo-ingress',
  {
    spec: {
      ingressClassName: 'nginx',
      rules: [
        {
          http: {
            paths: [
              {
                path: '/demo',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: svc_name,
                    port: {
                      number: PORT,
                    },
                  },
                },
              },
            ],
          },
        },
      ],
    },
  },
  { dependsOn: svc },
);
export const name = deployment.metadata.name;
