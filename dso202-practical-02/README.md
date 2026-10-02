# DSO202 Practical 02 — Persistent Storage and StatefulSets

## 1. Practical Overview

This repository contains the implementation and evidence for **DSO202 — Scaling, Orchestration, Monitoring & Observability, Practical 02**.

The practical demonstrates how Kubernetes manages persistent storage and stateful workloads. It covers:

* PersistentVolumes (PV)
* PersistentVolumeClaims (PVC)
* StorageClasses
* Static provisioning
* Dynamic provisioning
* `WaitForFirstConsumer`
* Reclaim policies
* Persistent storage with a Deployment
* StatefulSets
* Headless Services
* Stable Pod identities
* Per-Pod persistent volumes
* StatefulSet scaling
* Partitioned rolling updates
* PostgreSQL persistence

The practical finishes by deleting the PostgreSQL Pod and verifying that the database rows remain available after the replacement Pod starts.

## 2. Repository Structure

```text
dso202-practical-02/
├── README.md
├── cluster/
│   └── kind-cluster.yaml
├── manifests/
│   ├── 00-namespace.yaml
│   ├── 01-quota-and-limits.yaml
│   ├── 02-storageclass-retain.yaml
│   ├── 03-pv-static.yaml
│   ├── 04-pvc-static.yaml
│   ├── 05-pod-static-writer.yaml
│   ├── 06-pvc-dynamic.yaml
│   ├── 07-pod-dynamic-writer.yaml
│   ├── 08-deployment-shared-pvc.yaml
│   ├── 09-service-webnote.yaml
│   ├── 10-statefulset-webnote.yaml
│   ├── 11-pod-client.yaml
│   ├── 12-secret-postgres.yaml
│   ├── 13-service-postgres.yaml
│   └── 14-statefulset-postgres.yaml
├── evidence/
│   ├── screenshots/
│   └── tasktracker-dump.sql
└── report/
    └── practical-02-report.md
```

## 3. Software and Versions

The practical guide was verified against the following versions:

| Component  | Version                    |
| ---------- | -------------------------- |
| Docker     | 29.2.1                     |
| kind       | 0.32.0                     |
| Kubernetes | 1.36.1                     |
| kubectl    | 1.34.1                     |
| PostgreSQL | 18 Alpine                  |
| Cluster    | dso202-p2                  |

Before starting, verify the installed versions:

```bash
docker info --format '{{.ServerVersion}}'
kind version
kubectl version --client
```

## 4. Prerequisites

Roughly 3 GB of free disk space is recommended.

The following tools must be installed:

* Docker
* kind
* kubectl

The practical uses a three-node kind cluster.

## 5. Create the Host Storage Directory

The static PersistentVolume uses a host directory.

```bash
mkdir -p /tmp/dso202-p2-storage
```

Verify:

```bash
ls -ld /tmp/dso202-p2-storage
```

## 6. Create the Cluster

From the repository root:

```bash
kind create cluster --config cluster/kind-cluster.yaml
```

Verify:

```bash
kubectl get nodes -o wide
```

Verify the Docker containers:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

## 7. Create the Namespace and Storage Configuration

```bash
kubectl apply -f manifests/00-namespace.yaml
```

```bash
kubectl config set-context --current --namespace=dso202-practical-02
```

```bash
kubectl apply -f manifests/01-quota-and-limits.yaml
```

```bash
kubectl apply -f manifests/02-storageclass-retain.yaml
```

Verify:

```bash
kubectl get resourcequota
kubectl get limitrange
kubectl get storageclass
```

## 8. Static Provisioning

Apply the static PV:

```bash
kubectl apply -f manifests/03-pv-static.yaml
```

Apply the PVC:

```bash
kubectl apply -f manifests/04-pvc-static.yaml
```

Apply the writer Pod:

```bash
kubectl apply -f manifests/05-pod-static-writer.yaml
```

Wait for the Pod:

```bash
kubectl wait --for=condition=Ready pod/static-writer --timeout=90s
```

Verify:

```bash
kubectl get pv
kubectl get pvc
kubectl get pod static-writer -o wide
```

## 9. Dynamic Provisioning

Apply the dynamic PVC:

```bash
kubectl apply -f manifests/06-pvc-dynamic.yaml
```

Initially verify:

```bash
kubectl get pvc dynamic-data
kubectl describe pvc dynamic-data
```

The claim should initially remain Pending because the StorageClass uses `WaitForFirstConsumer`.

Create the writer:

```bash
kubectl apply -f manifests/07-pod-dynamic-writer.yaml
```

Wait:

```bash
kubectl wait --for=condition=Ready pod/dynamic-writer --timeout=120s
```

Verify:

```bash
kubectl get pvc dynamic-data
kubectl get pv
kubectl get pod dynamic-writer -o wide
```

## 10. Deployment with Shared Storage

This stage deliberately demonstrates the limitations of using a Deployment for a stateful workload.

```bash
kubectl apply -f manifests/08-deployment-shared-pvc.yaml
```

Wait:

```bash
kubectl rollout status deployment/shared-writer --timeout=180s
```

Inspect the replicas:

```bash
kubectl get pods -l app=shared-writer \
  -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName'
```

Inspect the shared file:

```bash
kubectl exec deploy/shared-writer -- cat /data/visitors.log
```

Delete the replicas:

```bash
kubectl delete pod -l app=shared-writer --field-selector status.phase=Running
```

Check the regenerated names:

```bash
kubectl get pods -l app=shared-writer \
  -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName'
```

Remove the experiment:

```bash
kubectl delete -f manifests/08-deployment-shared-pvc.yaml
```

## 11. StatefulSet

Create the headless Service:

```bash
kubectl apply -f manifests/09-service-webnote.yaml
```

Create the StatefulSet:

```bash
kubectl apply -f manifests/10-statefulset-webnote.yaml
```

Watch the Pods:

```bash
kubectl get pods -l app=webnote -w
```

Verify the claims:

```bash
kubectl get pvc -l app=webnote
```

Verify Pod placement:

```bash
kubectl get pods -l app=webnote \
  -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName,IP:.status.podIP'
```

## 12. StatefulSet DNS

Create the client:

```bash
kubectl apply -f manifests/11-pod-client.yaml
```

Wait:

```bash
kubectl wait --for=condition=Ready pod/client --timeout=90s
```

Resolve the headless Service:

```bash
kubectl exec client -- nslookup \
  webnote.dso202-practical-02.svc.cluster.local
```

Resolve a specific Pod:

```bash
kubectl exec client -- wget -qO- \
  http://webnote-1.webnote.dso202-practical-02.svc.cluster.local
```


## 13. StatefulSet Persistence Test

Delete one StatefulSet Pod:

```bash
kubectl delete pod webnote-1
```

Wait for replacement:

```bash
kubectl wait --for=condition=Ready pod/webnote-1 --timeout=120s
```

Check:

```bash
kubectl get pod webnote-1
kubectl get pvc content-webnote-1
```

The Pod name and PVC identity remain associated with ordinal 1 while the Pod IP may change.

## 14. PostgreSQL

Apply the credentials:

```bash
kubectl apply -f manifests/12-secret-postgres.yaml
```

Apply the Services:

```bash
kubectl apply -f manifests/13-service-postgres.yaml
```

Apply the StatefulSet:

```bash
kubectl apply -f manifests/14-statefulset-postgres.yaml
```

Wait:

```bash
kubectl wait --for=condition=Ready pod/postgres-0 --timeout=180s
```

Verify:

```bash
kubectl get pod postgres-0
kubectl get pvc data-postgres-0
kubectl get pv
```

## 15. PostgreSQL Persistence Test

Create the table:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"CREATE TABLE tasks (
    id serial PRIMARY KEY,
    title text NOT NULL,
    done boolean NOT NULL DEFAULT false
);"
```

Insert three records:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"INSERT INTO tasks (title)
VALUES
('Complete Practical 2'),
('Read Unit II notes'),
('Draft the report');"
```

Verify:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"SELECT id, title, done FROM tasks ORDER BY id;"
```

Delete the PostgreSQL Pod:

```bash
kubectl delete pod postgres-0
```

Wait:

```bash
kubectl wait --for=condition=Ready pod/postgres-0 --timeout=180s
```

Verify the data:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"SELECT count(*) FROM tasks;"
```

The result should be:

```text
 count
-------
     3
```

## 16. Create the SQL Backup

Before deleting the PostgreSQL workload:

```bash
mkdir -p evidence
```

Run:

```bash
kubectl exec postgres-0 -- \
  pg_dump -U taskuser -d tasktracker \
  > evidence/tasktracker-dump.sql
```

Verify:

```bash
ls -lh evidence/tasktracker-dump.sql
```

## 17. Final Cleanup

Capture the final state:

```bash
kubectl get all -o wide > evidence/final-state-all.txt
```

```bash
kubectl get pv,pvc,storageclass -o wide \
  > evidence/final-state-storage.txt
```

Delete the workloads:

```bash
kubectl delete -f manifests/14-statefulset-postgres.yaml
kubectl delete -f manifests/10-statefulset-webnote.yaml
kubectl delete -f manifests/11-pod-client.yaml
kubectl delete -f manifests/05-pod-static-writer.yaml
```

Check:

```bash
kubectl get pods
kubectl get pvc
```

Delete the claims:

```bash
kubectl delete pvc --all
```

Inspect:

```bash
kubectl get pv
```

Delete the static PV:

```bash
kubectl delete pv pv-web-static
```

Reset the context:

```bash
kubectl config set-context --current --namespace=default
```

Delete the cluster:

```bash
kind delete cluster --name dso202-p2
```

Verify:

```bash
kind get clusters
docker ps
```

Finally inspect the host storage:

```bash
ls -l /tmp/dso202-p2-storage/pv-web-static/
```

Only after evidence has been captured:

```bash
rm -rf /tmp/dso202-p2-storage
```

## 18. Evidence

The `evidence/` directory should contain the command outputs, screenshots and SQL dump required by the practical.

Passwords or other sensitive credentials are not included in screenshots.

## 19. Rebuilding the Practical

The practical can be rebuilt from a clean machine by:

1. Installing Docker, kind and kubectl.
2. Cloning this repository.
3. Creating `/tmp/dso202-p2-storage`.
4. Creating the kind cluster using `cluster/kind-cluster.yaml`.
5. Applying the numbered manifests in sequence.
6. Repeating the storage, StatefulSet and PostgreSQL tests.

The manifests are numbered so that the intended application order is clear.

## 20. Cleanup

After completing the practical:

```bash
kubectl config set-context --current --namespace=default
kind delete cluster --name dso202-p2
```

Confirm that no kind cluster remains:

```bash
kind get clusters
```

Remove the temporary host storage only after the report and evidence have been completed:

```bash
rm -rf /tmp/dso202-p2-storage
```

## 21. Learning Outcome

The practical demonstrates that persistent storage must be designed together with the workload controller.

A Deployment treats replicas as interchangeable, while a StatefulSet gives each replica a stable identity and dedicated persistent storage. The PostgreSQL experiment confirms that deleting a Pod does not delete the data stored in its persistent volume.
