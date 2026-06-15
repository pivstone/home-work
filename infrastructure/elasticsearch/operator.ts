import * as k8s from '@pulumi/kubernetes';
import * as pulumi from '@pulumi/pulumi';

export const releaseName = 'eck-operator';

export class EckOperator extends pulumi.ComponentResource {
  public readonly ns: pulumi.Output<string>;
  constructor(name: string, opts?: pulumi.ComponentResourceOptions) {
    super('eck-operator', name, opts);

    const ns = new k8s.core.v1.Namespace('elastic-system', {
      metadata: { name: 'elastic-system' },
    });

    new k8s.helm.v4.Chart(
      releaseName,
      {
        repositoryOpts: { repo: 'https://helm.elastic.co' },
        namespace: ns.metadata.name,
        chart: 'eck-operator',
        version: '3.4.0',
      },
      { dependsOn: ns },
    );

    this.ns = ns.metadata.name;
    this.registerOutputs({ ns: this.ns });
  }
}
