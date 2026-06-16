# Kubernetes Observability Stack

Nx and PNPM monorepo for deploying a local Kubernetes observability stack with Pulumi.

The workspace provisions:

- an NGINX ingress controller
- a demo NGINX application that returns the server IP
- Elastic Cloud on Kubernetes resources for Elasticsearch, Kibana, and Beats
- kube-prometheus-stack for Prometheus and Grafana
- generated Pulumi CRD bindings used by the Elastic stack

## Assignment Coverage

| Requirement | Implementation |
| --- | --- |
| Local Minikube cluster | Documented Minikube startup command with the flags required by the monitoring stack |
| NGINX app with 2 replicas | `packages/demo` Pulumi deployment with `replicas: 2` |
| NGINX exposed on NodePort 30080 | `packages/demo` Service of type `NodePort` with `nodePort: 30080` |
| GET `/` returns pod IP | NGINX template reads `POD_IP` from the Kubernetes downward API and returns it as plain text |
| `server_ip` response header | NGINX template adds the `server_ip` header with the same `POD_IP` value |
| Elasticsearch and Kibana | `infrastructure/elasticsearch` deploys ECK, Elasticsearch, and Kibana connected by `elasticsearchRef` |
| Prometheus metrics | `infrastructure/prometheus` deploys kube-prometheus-stack |
| Centralized pod logs | ECK Beat/Filebeat DaemonSet collects `/var/log/containers/*.log` into Elasticsearch |

The assignment asks for Terraform modules. This repository uses Pulumi with TypeScript instead, as described in [Design Decisions](#design-decisions).

## Prerequisites

- Node.js 22
- PNPM 11.5.3
- Minikube
- Pulumi CLI
- `kubectl`

Install the main local tools with Homebrew:

```sh
brew install minikube
brew install pulumi/tap/pulumi
```

If this is your first time using Pulumi locally, use local state storage:

```sh
pulumi login --local
```

## Start Minikube

Start Minikube with containerd and webhook auth enabled. The monitoring stack expects the scheduler and controller manager metrics endpoints to be reachable from the cluster.

```sh
minikube start \
  --container-runtime=containerd \
  --memory=6g \
  --bootstrapper=kubeadm \
  --extra-config=kubelet.authentication-token-webhook=true \
  --extra-config=kubelet.authorization-mode=Webhook \
  --extra-config=scheduler.bind-address=0.0.0.0 \
  --extra-config=controller-manager.bind-address=0.0.0.0
```

## Install and Build

Install dependencies from the repository root:

```sh
pnpm install
```

Build the generated CRD package:

```sh
pnpm nx run-many -t build
```

Typecheck every Nx project:

```sh
pnpm nx run-many -t typecheck
```

PNPM is configured with `minimumReleaseAge` to avoid installing dependencies released in the last three days.

## Deploy

Deploy the stacks in this order. Paths below assume you start from the repository root before each step.

### 1. NGINX Ingress Controller

```sh
cd infrastructure/nginx
pulumi up
```

Confirm the preview when Pulumi prompts you. This stack uses the passphrase `Password`.

### 2. Demo Application

```sh
cd packages/demo
pulumi up
```

After deployment, expose the service through Minikube:

```sh
curl "http://$(minikube ip):30080/" -i
```

The response should include a `server_ip` header and the same pod IP in the response body.

```text
HTTP/1.1 200 OK
server_ip: 10.244.0.12

10.244.0.12
```

### 3. Elasticsearch and Kibana

```sh
cd infrastructure/elasticsearch
pulumi up
```

This stack depends on the NGINX ingress controller. If Pulumi asks for a passphrase and you have not configured one, press Enter.

Start a Minikube tunnel before opening Kibana:

```sh
minikube tunnel
```

Then open Kibana:

```text
http://127.0.0.1/kibana
```

The Kibana username is `elastic`. Get the generated password from the Kubernetes secret:

```sh
kubectl get secret default-895e5c71-es-elastic-user \
  -o=jsonpath='{.data.elastic}' | base64 --decode
```

In Kibana, search for `Logs` to inspect container logs collected from the cluster.

### 4. Prometheus and Grafana

```sh
cd infrastructure/prometheus
pulumi up
```

If Pulumi asks for a passphrase and you have not configured one, press Enter.

The stack installs kube-prometheus-stack, including Prometheus Operator, Grafana, default dashboards, alerting rules, and cluster metric collection.

Expose Grafana with Minikube:

```sh
minikube service -n monitoring prometheus-stack-grafana --url
```

The Grafana username is `admin`. Get the generated password from the Kubernetes secret:

```sh
kubectl get secret -n monitoring prometheus-stack-grafana \
  -o=jsonpath='{.data.admin-password}' | base64 --decode
```

## Workspace Layout

```text
infrastructure/
  elasticsearch/   Pulumi stack for ECK, Elasticsearch, Kibana, and Beats
  nginx/           Pulumi stack for the NGINX ingress controller
  prometheus/      Pulumi stack for kube-prometheus-stack and Grafana
packages/
  crds/            Exported Elastic Kubernetes CRD YAML files
  demo/            Demo NGINX application
  generated/       Generated Pulumi package for the CRDs
```

Nx projects:

- `nginx`
- `demo`
- `elasticsearch`
- `prometheus`
- `@pulumi/crds`

## Useful Commands

Run available builds:

```sh
pnpm nx run-many -t build
```

Run typechecks:

```sh
pnpm nx run-many -t typecheck
```

Show Nx projects:

```sh
pnpm nx show projects
```

Get the Elasticsearch password:

```sh
pnpm --dir infrastructure/elasticsearch run password
```

Get the Grafana password:

```sh
pnpm --dir infrastructure/prometheus run password
```

## Notes

- The first version used CDK8s. This version uses Pulumi because it provides a more complete infrastructure-as-code workflow without leaning on the AWS CDK ecosystem.
- Pulumi supports unit testing, but this repository keeps only the generated tests because testing the Pulumi programs is not the focus of the homework.
- The monorepo was initialized with Nx. Agent configuration and GitHub workflow files are included as part of that setup.
- AI tools used: Duck.AI for search and Codex for local code review and README polish.

## Design Decisions

- Pulumi was chosen over Terraform because the TypeScript programming model fits backend-oriented development better than a dedicated DSL for this project.
- Kubernetes operators are preferred for complex applications such as Elasticsearch and Prometheus because they package domain-specific lifecycle management instead of requiring every Kubernetes resource to be maintained manually.
