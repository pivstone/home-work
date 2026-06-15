import * as k8s from '@pulumi/kubernetes';
import * as elasticsearch from '@pulumi/crds/elasticsearch/v1';
import * as kibana from '@pulumi/crds/kibana/v1';
import { Beat } from '@pulumi/crds/beat/v1beta1';
import * as pulumi from '@pulumi/pulumi';

export class ElasticStack extends pulumi.ComponentResource {
  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super('elk-instance', name, opts);

    const childOpts = pulumi.mergeOptions(opts, { parent: this });

    const es = new elasticsearch.Elasticsearch(
      name,
      {
        spec: {
          version: '9.4.2',
          nodeSets: [
            {
              count: 1,
              name,
              config: {
                'node.store.allow_mmap': false,
              },
            },
          ],
        },
      },
      childOpts,
    );

    const kb = new kibana.Kibana(
      name,
      {
        metadata: {},
        spec: {
          version: '9.4.2',
          config: {
            'server.basePath': '/kibana',
            'server.rewriteBasePath': true,
          },
          count: 1,
          elasticsearchRef: { name: es.metadata.name },
          http: {
            tls: {
              selfSignedCertificate: {
                disabled: true,
              },
            },
          },
        },
      },
      pulumi.mergeOptions(childOpts, { dependsOn: es }),
    );

    new k8s.networking.v1.Ingress(
      'kibana-ingress',
      {
        spec: {
          ingressClassName: 'nginx',
          rules: [
            {
              http: {
                paths: [
                  {
                    path: '/kibana',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: kb.metadata.apply((m) => `${m.name}-kb-http`),
                        port: {
                          number: 5601,
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
      pulumi.mergeOptions(childOpts, { dependsOn: kb }),
    );

    new Beat(
      name,
      {
        spec: {
          type: 'filebeat',
          version: '9.4.2',
          elasticsearchRef: { name: es.metadata.name },
          config: {
            'filebeat.inputs': [
              {
                type: 'filestream',
                id: 'container-logs-id',
                'prospector.scanner.symlinks': true,
                parsers: [
                  {
                    container: {
                      stream: 'stdout',
                      format: 'docker',
                    },
                  },
                ],
                paths: ['/var/log/containers/*.log'],
              },
            ],
          },
          daemonSet: {
            podTemplate: {
              spec: {
                dnsPolicy: 'ClusterFirstWithHostNet',
                hostNetwork: true,
                securityContext: {
                  runAsUser: 0,
                },
                volumes: [
                  {
                    name: 'varlogcontainers',
                    hostPath: {
                      path: '/var/log/containers',
                    },
                  },
                  {
                    name: 'varlogpods',
                    hostPath: {
                      path: '/var/log/pods',
                    },
                  },
                  {
                    name: 'varlibdockercontainers',
                    hostPath: {
                      path: '/var/lib/docker/containers',
                    },
                  },
                ],
                containers: [
                  {
                    name: 'filebeat',
                    volumeMounts: [
                      {
                        name: 'varlogcontainers',
                        mountPath: '/var/log/containers',
                      },
                      {
                        name: 'varlogpods',
                        mountPath: '/var/log/pods',
                      },
                      {
                        name: 'varlibdockercontainers',
                        mountPath: '/var/lib/docker/containers',
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      pulumi.mergeOptions(childOpts, { dependsOn: es }),
    );
  }
}
