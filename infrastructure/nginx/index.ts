import * as k8s from '@pulumi/kubernetes';
import * as nginx from '@pulumi/kubernetes-ingress-nginx';

// Create a sandbox namespace.
const ns = new k8s.core.v1.Namespace('nginx-ns');

new nginx.IngressController(
  'nginx-ctrl',
  {
    controller: {
      config: {
        'hsts-max-age': '31536000',
      },
      hostPort: {
        enabled: true,
      },
      publishService: {
        enabled: true,
      },
      service: {
        type: 'NodePort',
        externalTrafficPolicy: 'Local',
      },
    },
    helmOptions: {
      namespace: ns.metadata.name,
    },
  },
  { dependsOn: ns },
);
