# DSO202 Practical 1 — Local Kubernetes Cluster with kind

## Purpose of this repository

This repository contains the full configuration, workload manifests and evidence for DSO202 Practical 1: setting up a local Kubernetes cluster with kind and deploying a first application workload.

It includes:

- the kind cluster definition in `cluster/kind-cluster.yaml`
- Kubernetes manifests for the namespace, quota, limits, Pods, Deployment, Services and client pod in `manifests/`
- captured evidence logs and screenshots in `evidence/`
- the written reflection and report in `report/practical-01-report.md`

The objective is to demonstrate how to:

- create a 3-node local Kubernetes cluster with kind
- inspect the Kubernetes control plane and nodes
- apply namespace isolation and resource controls
- deploy a sample Nginx web workload
- manage applications with Pods, Deployments, ReplicaSets and Services
- verify Service discovery and NodePort access
- reproduce the exercise using declarative manifests

---

## Software versions used

The practical was completed on the following environment:

| Component | Version / detail |
|---|---|
| Operating system | Pop!_OS 22.04 LTS |
| Docker | v29.2.1 |
| kind | v0.32.0 |
| kubectl | v1.36 |
| Kubernetes cluster | v1.36.1 |
| Cluster name | `dso202` |
| Cluster topology | 1 control-plane + 2 worker nodes |
| Container image used | `nginx:1.30-alpine` |
| Namespace used in manifests | `dso202-practical-01` |
| Host NodePort used | `30080` |

The cluster definition pins the node image to:

```text
kindest/node:v1.36.1@sha256:3489c7674813ba5d8b1a9977baea8a6e553784dab7b84759d1014dbd78f7ebd5
```

---

## Rebuild the practical from an empty machine

Use the commands below in order from a fresh Linux machine with Docker, kind and kubectl installed.

### 1) Install the required tools

If Docker, kind and kubectl are not already installed, install them first. 

Then verify that the tools are available:

```bash
docker info --format '{{.ServerVersion}} {{.OperatingSystem}}'
kind version
kubectl version --client
```

### 2) Clone the repository and enter the practical folder

```bash
git clone <repository-url>
cd dso202-practical-01
```

### 3) Create the kind cluster

```bash
kind create cluster --config cluster/kind-cluster.yaml
kind get clusters
kind get nodes --name dso202
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
kubectl config current-context
```

This creates the cluster named `dso202` with one control-plane node and two worker nodes.

### 4) Create the namespace and resource controls

```bash
kubectl apply -f manifests/00-namespace.yaml
kubectl config set-context --current --namespace=dso202-practical-01
kubectl apply -f manifests/01-quota-and-limits.yaml
kubectl describe resourcequota dso202-quota
kubectl describe limitrange dso202-limits
```

### 5) Create the initial Pod and inspect labels

```bash
kubectl apply -f manifests/02-pod-web.yaml
kubectl get pod web-pod -o wide --show-labels
kubectl describe pod web-pod
kubectl logs web-pod --tail=5
```

Optional Pod access checks:

```bash
kubectl exec -it web-pod -- sh
kubectl exec web-pod -- nginx -v
kubectl port-forward pod/web-pod 8080:80
```

In a second terminal on the host:

```bash
curl -s http://localhost:8080
```

### 6) Deploy the application with a Deployment

```bash
kubectl apply -f manifests/03-deployment-web.yaml
kubectl rollout status deployment/web-deployment
kubectl get deployment,replicaset,pod -l app=web
kubectl get pods -l app=web --watch
```

Test self-healing and scaling:

```bash
victim=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$victim"
kubectl get pods -l app=web
kubectl scale deployment web-deployment --replicas=5
kubectl get deployment web-deployment
kubectl apply -f manifests/03-deployment-web.yaml
```

### 7) Create the Services and test access

```bash
kubectl apply -f manifests/04-service-clusterip.yaml
kubectl apply -f manifests/05-service-nodeport.yaml
kubectl apply -f manifests/06-pod-client.yaml
kubectl wait --for=condition=Ready pod/client-pod --timeout=60s

kubectl get service
kubectl get endpointslice -l kubernetes.io/service-name=web-clusterip
kubectl exec client-pod -- nslookup web-clusterip
kubectl exec client-pod -- wget -qO- http://web-clusterip
curl -s http://localhost:30080
docker exec dso202-worker curl -s http://localhost:30080
```

Optional service validation:

```bash
kubectl get all -n dso202-practical-01
kubectl get all -o wide
```

---

## Cleanup commands

When you are finished with the practical, remove the workloads first and then delete the cluster.

### Remove workload resources

```bash
kubectl delete -f manifests/06-pod-client.yaml
kubectl delete -f manifests/05-service-nodeport.yaml
kubectl delete -f manifests/04-service-clusterip.yaml
kubectl delete -f manifests/03-deployment-web.yaml
kubectl delete -f manifests/02-pod-web.yaml
kubectl delete -f manifests/01-quota-and-limits.yaml
kubectl delete -f manifests/00-namespace.yaml
kubectl get all
```

### Reset namespace and delete the kind cluster

```bash
kubectl config set-context --current --namespace=default
kind delete cluster --name dso202
kind get clusters
docker ps
```

This leaves the machine clean and returns it to the pre-practical state.

---

## Rebuild after cleanup

If you want to recreate the practical after deleting the cluster, just recreate the cluster and reapply the manifests:

```bash
kind create cluster --config cluster/kind-cluster.yaml
kubectl config set-context --current --namespace=dso202-practical-01
kubectl apply -f manifests/
kubectl get all -n dso202-practical-01
```

---

## Repository structure

```text
.dso202-practical-01/
├── cluster/
│   └── kind-cluster.yaml
├── evidence/
│   ├── final-state-all.txt
│   ├── final-state-events.txt
│   ├── final-state-nodes.txt
│   └── web-imperative-as-stored.yaml
├── manifests/
│   ├── 00-namespace.yaml
│   ├── 01-quota-and-limits.yaml
│   ├── 02-pod-web.yaml
│   ├── 03-deployment-web.yaml
│   ├── 04-service-clusterip.yaml
│   ├── 05-service-nodeport.yaml
│   └── 06-pod-client.yaml
├── report/
│   └── practical-01-report.md
└── README.md
```

For the full narrative, analysis and troubleshooting notes, see `report/practical-01-report.md`.
