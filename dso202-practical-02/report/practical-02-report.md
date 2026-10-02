# DSO202 — Practical_2 Report

## Implementing Persistent Storage for a Stateful Application in Kubernetes

**Module:** DSO202 — Scaling, Orchestration, Monitoring & Observability  
**Programme:** BE in Software Engineering  
**Practical:** 02 of 10  
**Student Name:** Tshering Phuntsho  
**Student Number:** 02230310   
**Date:** 06 September, 2026

# 1. Objective

The objective of this practical was to implement and examine persistent storage for stateful applications in Kubernetes.

The practical focused on PersistentVolumes (PV), PersistentVolumeClaims (PVC), StorageClasses, static and dynamic provisioning, reclaim policies, StatefulSets and headless Services. A Deployment using a shared volume was also tested deliberately to observe the limitations of using a stateless workload controller for stateful applications.

The final part of the practical deployed PostgreSQL as a StatefulSet. Data was inserted into the database, the PostgreSQL Pod was deleted, and the database was accessed again after the replacement Pod started to verify that the stored data persisted.

# 2. Environment

## Check versions

Run:

```bash
docker info --format '{{.ServerVersion}}'
kind version
kubectl version --client
```

![environment verification](/dso202-practical-02/evidence/screenshots/checkVersion.png)

**Operating System:** Ubuntu 24.04 LTS  
**Docker Version:** 29.2.1  
**kind Version:** 0.32.0  
**Kubectl Version:** 1.34.1  
**postgres:** 18-alpine  

The practical used the kind cluster: dso202-p2

## Create the static-storage host directory

The temporary host directory was created using:

```bash
mkdir -p /tmp/dso202-p2-storage
ls -ld /tmp/dso202-p2-storage
```
Then check available disk:
```bash
df -h /var/lib/docker 2>/dev/null || df -h /
```

![storage directory](/dso202-practical-02/evidence/screenshots/hostDirectory.png)

Stage 2 uses for statically provisioned storage.

# 3. Procedure and Observations

## 3.1 Stage 1 — Cluster, Namespace and the Storage Landscape

The practical began by creating a three-node kind cluster using the supplied cluster configuration.


The cluster was then created using:

```bash
kind create cluster --config cluster/kind-cluster.yaml
```
![kind cluster](/dso202-practical-02/evidence/screenshots/kindCluster.png)

The nodes were checked using:

```bash
kubectl get nodes -o wide
docker ps --format 'table {{.Names}}\t{{.Status}}'
```
![nodes](/dso202-practical-02/evidence/screenshots/nodes.png)

The Kubernetes cluster (Kind) consists of three active nodes:   

- dso202-p2-control-plane  
- dso202-p2-worker  
- dso202-p2-worker2  

All running for 6 minutes. The additional container floci is an external background utility service running on the local host machine and is not part of the active Kind Kubernetes cluster configuration.

Confirm the mounted host directory:
```bash
docker exec dso202-p2-worker ls -ld /mnt/dso202-static
```
![mounted](/dso202-practical-02/evidence/screenshots/mounted.png)

**Created the namespace, the quota and the retaining StorageClass**

Apply the first three manifests:

![namespaceQuotaRetain](/dso202-practical-02/evidence/screenshots/namespaceQuotaRetain.png)

Inspect the quota:
```bash
kubectl describe resourcequota dso202-p2-quota
```

![inspectQuota](/dso202-practical-02/evidence/screenshots/inspectQuota.png)

The output shows the resource quota limits, requests and current usage constraints configured for memory, CPU, pods and other Kubernetes resources within the namespace.


The storage classes were inspected using:

```bash
kubectl get storageclass
```

The local-path provisioner was checked using:

```bash
kubectl -n local-path-storage get pods
```

The provisioner configuration was inspected to identify its node storage path.

![storageClass](/dso202-practical-02/evidence/screenshots/storageClass.png)

### Observation

The kind cluster contained a control-plane node and two worker nodes. The local-path provisioner provided the storage mechanism used by the practical.

The `dso202-retain` StorageClass used the `Retain` reclaim policy, while the default `standard` StorageClass used `Delete`. Both uses WaitForFirstConsumer.

`"/var/local-path-provisioner"` path is where dynamically provisioned volumes are stored on the node.

## 3.2 Stage 2 — Static Provisioning

The static PersistentVolume was created using:

```bash
kubectl apply -f manifests/03-pv-static.yaml
```
Inspect the result:

```bash
kubectl get pv
```
![persistentVolume](/dso202-practical-02/evidence/screenshots/persistentVolume.png)

The VOLUMEATTRIBUTESCLASS column is printed by kubectl v1.34 and later and stays < unset > throughout this practical. The phase is Available: the volume exists and no claim owns it.

Read the two fields that constrain scheduling:

```bash
kubectl get pv pv-web-static -o jsonpath='{.spec.hostPath.path}{"\n"}'
kubectl get pv pv-web-static -o jsonpath='{.spec.nodeAffinity}{"\n"}'
```
![constrain scheduling](/dso202-practical-02/evidence/screenshots/scheduling.png)

The output shows that persistent volume pv-web-static uses the host directory /mnt/dso202-static/pv-web-static and is scheduled strictly on nodes labeled with dso202/node-index=1 via node affinity rules.

The PersistentVolumeClaim was then created:

```bash
kubectl apply -f manifests/04-pvc-static.yaml
```
![pvc](/dso202-practical-02/evidence/screenshots/pvc.png)

Inspected with : `kubectl get pvc`

The PVC became bound to the static PV. No StorageClass object named manual exists in this cluster.

The static writer Pod was created using:

```bash
kubectl apply -f manifests/05-pod-static-writer.yaml
```

After the Pod became ready, the stored file was inspected:

```bash
kubectl exec static-writer -- cat /data/ledger.txt
```

The same file was also checked from the host:

```bash
cat /tmp/dso202-p2-storage/pv-web-static/ledger.txt
```

![writer](/dso202-practical-02/evidence/screenshots/writer.png)

The writer Pod was then deleted and recreated.

The file was read again:

```bash
kubectl exec static-writer -- cat /data/ledger.txt
```
![recreated](/dso202-practical-02/evidence/screenshots/recreated.png)

The previous content remained available.

![deleted](/dso202-practical-02/evidence/screenshots/deleted.png)

The Pod and PVC were then deleted, and the PV entered the `Released` phase.

**Verify the physical data still exists**
```bash
cat /tmp/dso202-p2-storage/pv-web-static/ledger.txt
kubectl delete pv pv-web-static
ls -l /tmp/dso202-p2-storage/pv-web-static/
```
![physicalData](/dso202-practical-02/evidence/screenshots/physicalData.png)

This demonstrates that deleting the Kubernetes PV object does not automatically delete the underlying host data.

**Recreate everything**
```bash
kubectl apply -f manifests/03-pv-static.yaml
kubectl apply -f manifests/04-pvc-static.yaml
kubectl apply -f manifests/05-pod-static-writer.yaml
kubectl wait --for=condition=Ready pod/static-writer --timeout=90s
kubectl exec static-writer -- cat /data/ledger.txt
```
![everything](/dso202-practical-02/evidence/screenshots/everything.png)

A new volume object, a new claim and a new Pod adopted data written before any of them existed.

### Observation

The experiment demonstrated that the data existed independently of the Pod. Deleting and recreating the Pod did not remove the data stored on the persistent volume.

After the PVC was deleted, the PV entered the `Released` phase because the StorageClass/PV used the `Retain` policy.

The underlying host file remained even after the PV Kubernetes object was deleted.

## 3.3 Stage 3 — Dynamic Provisioning

The dynamic PVC was created using:

```bash
kubectl apply -f manifests/06-pvc-dynamic.yaml
```

Immediately after creation, the claim was inspected:

```bash
kubectl get pvc dynamic-data
```

The PVC initially remained in the `Pending` state.

The reason was examined using:

```bash
kubectl describe pvc dynamic-data | tail -n 6
```
![dynamic](/dso202-practical-02/evidence/screenshots/dynamic.png)

The events indicated:

```text
WaitForFirstConsumer
```
This claim is not broken. The standard class uses WaitForFirstConsumer, so the control plane refuses to choose storage until it knows which node the Pod will run on.

A Pod was then created:

```bash
kubectl apply -f manifests/07-pod-dynamic-writer.yaml
```
![dynamic writer](/dso202-practical-02/evidence/screenshots/menifest7.png)

After the Pod was ready, the PVC and PV were checked again.

The mounted filesystem was inspected using:

```bash
kubectl exec dynamic-writer -- df -h /data
```

Finally, an attempt was made to increase the PVC size:

```bash
kubectl patch pvc dynamic-data --type merge \
  -p '{"spec":{"resources":{"requests":{"storage":"2Gi"}}}}'
```
![uncomfortable](/dso202-practical-02/evidence/screenshots/uncomfortable.png)

The rejection comes from the API server, not from the provisioner and it is caused by allowVolumeExpansion: false on the class.

**Delete dynamic resources**

![resources](/dso202-practical-02/evidence/screenshots/resources.png)

The claim, the volume object and the directory on the node all disappeared and the second command printed nothing.

### Observation

The PVC remained Pending initially because the StorageClass used `WaitForFirstConsumer`. Once a Pod required the PVC, Kubernetes could determine the scheduling location and dynamically provision the volume.

The resize operation was rejected because volume expansion was disabled for the StorageClass.


## 3.4 Stage 4 — Deployment with Shared PVC

A Deployment with three replicas was created using:

```bash
kubectl apply -f manifests/08-deployment-shared-pvc.yaml
```

The Deployment was checked using:

```bash
kubectl rollout status deployment/shared-writer --timeout=180s
```

The Pod placement was examined using:

```bash
kubectl get pods -l app=shared-writer \
  -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName'
```
![stage4](/dso202-practical-02/evidence/screenshots/stage4.png)

### Observation 1 — Storage affected placement

The shared log was inspected using:

```bash
kubectl exec deploy/shared-writer -- cat /data/visitors.log
```
![O1](/dso202-practical-02/evidence/screenshots/O1.png)

All three replicas were scheduled onto the same node because the single RWO volume was local to one node.

### Observation 2 — The replicas shared one volume

All three replicas accessed the same storage and therefore wrote to the same file.

This demonstrates why sharing one database data directory between multiple independent database processes is not an appropriate architecture.

![O2](/dso202-practical-02/evidence/screenshots/O2.png)


### Observation 3 — Pod identity was not stable

After the Deployment Pods were deleted, new Pod names were generated.

The original Pod identities were not retained.

![O3](/dso202-practical-02/evidence/screenshots/O3.png)

## 3.5 Stage 5 — StatefulSet and Stable Identity

A headless Service was created:

```bash
kubectl apply -f manifests/09-service-webnote.yaml
```
Check:
```bash
kubectl get service webnote
```
![webnote](/dso202-practical-02/evidence/screenshots/webnote.png)

CLUSTER-IP reads None. No virtual address was allocated, and no load balancing will occur. The Service exists to publish DNS records. That means it is a headless Service.

The StatefulSet was then created:

```bash
kubectl apply -f manifests/10-statefulset-webnote.yaml
```

The Pods were monitored:

```bash
kubectl get pods -l app=webnote -w
```
![statefull](/dso202-practical-02/evidence/screenshots/statefull.png)

The resulting Pods were named:

```text
webnote-0
webnote-1
webnote-2
```
The Pods are created in ordinal order.

The PVCs were checked:

```bash
kubectl get pvc -l app=webnote
```
![Check PVCs](/dso202-practical-02/evidence/screenshots/checkPVC.png)

Three individual PVCs were created, one for each StatefulSet ordinal.

**Check Pod placement**

![Check Pod Placement](/dso202-practical-02/evidence/screenshots/checkPodPlacement.png)

The Pods are no longer required to share one volume. This confirm that placement is now free, because each Pod has its own volume.

A client Pod was then created:

```bash
kubectl apply -f manifests/11-pod-client.yaml
```

DNS was tested:

```bash
kubectl exec client -- nslookup \
  webnote.dso202-practical-02.svc.cluster.local
```
![pod client](/dso202-practical-02/evidence/screenshots/podclient.png)

A specific Pod was accessed using its StatefulSet DNS name.

**Prove the volumes are private**

![private](/dso202-practical-02/evidence/screenshots/private.png)

Three replicas of one workload, three different files.

**Prove that identity and storage survive deletion**

![storage survive deletion](/dso202-practical-02/evidence/screenshots/storageSurviveDeletion.png)

Important observations:
- webnote-1 kept the same name.
- The PVC was not recreated.
- The original created: timestamp remained.
- The IP address changed.


### Observation

The StatefulSet provided stable Pod identities and individual persistent volumes. The headless Service provided DNS records for the individual StatefulSet Pods.

The Pods were created in ordinal order and each ordinal received its own PVC.

The Pod name remained `webnote-1`, the PVC remained associated with ordinal 1, and the Pod received a new IP address.

The original `created:` timestamp remained in the stored file, demonstrating that the volume was reused rather than recreated.

## 3.6 Stage 6 — Scaling, Retention and Rolling Update

### Scaling

The StatefulSet was scaled to four replicas:

```bash
kubectl scale statefulset webnote --replicas=4
```
![scaling](/dso202-practical-02/evidence/screenshots/scaling.png)

The new PVC was verified.

The StatefulSet was then scaled down:

```bash
kubectl scale statefulset webnote --replicas=2
```

The higher ordinals were terminated first.

The retained PVCs were then checked:

```bash
kubectl get pvc -l app=webnote
```
![scaled down](/dso202-practical-02/evidence/screenshots/scaleDown.png)

We should still have four PVCs because the manifest uses retention behavior that preserves the claims when scaling down.

### Partitioned rollout

The StatefulSet manifest was changed so that:

```yaml
partition: 2
```
![partition](/dso202-practical-02/evidence/screenshots/partition.png)

and the image was changed from:

```yaml
nginx:1.30-alpine
```

to:

```yaml
nginx:1.31-alpine
```
![image](/dso202-practical-02/evidence/screenshots/image.png)

After applying the manifest, only the Pod at ordinal 2 was updated.

![after applying](/dso202-practical-02/evidence/screenshots/afterApplying.png)

The partition was then changed back to:

```yaml
partition: 0
```
and the remaining Pods were updated.

![back](/dso202-practical-02/evidence/screenshots/rollBack.png)

All three should now use: `nginx:1.31-alpine`

**Deleted the controller and kept the data**

![data](/dso202-practical-02/evidence/screenshots/data.png)

## 3.7 Stage 7 — PostgreSQL StatefulSet

The PostgreSQL credentials were created:

```bash
kubectl apply -f manifests/12-secret-postgres.yaml
```

The PostgreSQL Services were created:

```bash
kubectl apply -f manifests/13-service-postgres.yaml
```
![services](/dso202-practical-02/evidence/screenshots/services.png)

The PostgreSQL StatefulSet was deployed:

```bash
kubectl apply -f manifests/14-statefulset-postgres.yaml
```

The Pod was monitored until ready:

```bash
kubectl wait --for=condition=Ready pod/postgres-0 --timeout=180s
```

The PVC was checked:

```bash
kubectl get pvc data-postgres-0
```
![deployed](/dso202-practical-02/evidence/screenshots/deployed.png)

The PostgreSQL storage used the `dso202-retain` StorageClass.

### Database creation

A `tasks` table was created:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"CREATE TABLE tasks (
    id serial PRIMARY KEY,
    title text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);"
```
![table](/dso202-practical-02/evidence/screenshots/createdTable.png)

Three rows were inserted:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"INSERT INTO tasks (title)
VALUES
('Complete Practical 2'),
('Read Unit II notes'),
('Draft the report');"
```
![insert](/dso202-practical-02/evidence/screenshots/insert.png)

The rows were verified:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"SELECT id, title, done FROM tasks ORDER BY id;"
```
![select](/dso202-practical-02/evidence/screenshots/select.png)

### Persistence test

The PostgreSQL Pod was deleted:

```bash
kubectl delete pod postgres-0
```

The replacement was awaited:

```bash
kubectl wait --for=condition=Ready pod/postgres-0 --timeout=180s
```

The row count was then checked:

```bash
kubectl exec postgres-0 -- psql -U taskuser -d tasktracker -c \
"SELECT count(*) FROM tasks;"
```
![persistence test](/dso202-practical-02/evidence/screenshots/persistenceTest.png)

### Observation

The replacement PostgreSQL Pod returned a row count of:

```text
3
```

This demonstrated that the database data remained available after the original PostgreSQL Pod was deleted.

## 3.8 Stage 8 — Cleanup and Reclaim Policies

Before cleanup, the final storage state was captured:

```bash
kubectl get all -o wide > evidence/final-state-all.txt
kubectl get pv,pvc,storageclass -o wide > evidence/final-state-storage.txt
kubectl get statefulset webnote -o yaml > evidence/final-statefulset-webnote.yaml
kubectl get events --sort-by=.lastTimestamp > evidence/final-state-events.txt
```

A PostgreSQL dump was created:

```bash
kubectl exec postgres-0 -- \
  pg_dump -U taskuser -d tasktracker \
  > evidence/tasktracker-dump.sql
```

The workloads were deleted.

```bash
kubectl delete -f manifests/14-statefulset-postgres.yaml
kubectl delete -f manifests/10-statefulset-webnote.yaml
kubectl delete -f manifests/11-pod-client.yaml
kubectl delete -f manifests/05-pod-static-writer.yaml
kubectl get pods
```
![cleanup](/dso202-practical-02/evidence/screenshots/cleanup.png)

The remaining PVCs were then inspected.

All PVCs were explicitly deleted:

```bash
kubectl delete pvc --all
```

The PVs were checked again:

```bash
kubectl get pv
```
![explicitly deleted](/dso202-practical-02/evidence/screenshots/explicit.png)

The important lesson is that deleting a StatefulSet does not automatically delete the PVCs created through its `volumeClaimTemplates`.

### Observation

The dynamically provisioned volumes using the `Delete` reclaim policy were removed together with their claims.

The volumes using the `Retain` reclaim policy entered the `Released` phase.

A `Released` PV was not automatically returned to the `Available` phase because it may still contain data from the previous workload.

The cluster was then deleted:

```bash
kubectl config set-context --current --namespace=default
kind delete cluster --name dso202-p2
```
![cluster deleted](/dso202-practical-02/evidence/screenshots/clusterDeleted.png)

The final host storage was checked before removing it. Note: floci is not a part of this practical.

# 4. Analysis

## 4.1 Why was the Stage 3 PVC Pending while the Stage 2 PVC bound immediately?

The difference was controlled by the volume binding mode.

The dynamically provisioned `standard` StorageClass uses:

```text
WaitForFirstConsumer
```

Therefore, Kubernetes waits until a Pod consumes the PVC before selecting the node and provisioning the storage.

The static Stage 2 PV was already created manually and matched the PVC. Therefore, no dynamic provisioning or waiting for a consumer was required.

## 4.2 What determined whether the storage survived PVC deletion?

The reclaim policy determined what happened after the PVC was deleted.

For Stage 2 and the PostgreSQL StatefulSet, the relevant storage used:

```text
Retain
```

Therefore, the underlying storage was preserved and the PV entered the `Released` state.

The dynamic Stage 3 volume used:

```text
Delete
```

Therefore, deleting the PVC also caused the dynamically provisioned volume to be removed.

The reclaim policy is associated with the PersistentVolume or inherited from the StorageClass that provisioned it.

In an organisation, the StorageClass policy would normally be selected by the platform or infrastructure administrators according to the workload's data-retention requirements.

## 4.3 Why did the Deployment place all three replicas on one node?

The Deployment replicas referred to the same RWO PVC.

The volume was local to one node. Therefore, the Pods could not freely move to other nodes because their required storage was available only on the node containing that volume.

On a managed cloud cluster using a zonal network disk, a Pod scheduled to another node could instead encounter a volume attachment or multi-attach limitation, depending on the storage system and access mode.

The local kind cluster hides this failure because multiple Pods can mount an RWO volume when they are located on the same node.

## 4.4 What is the fully qualified DNS name of the second webnote replica?

The second replica has ordinal `1`.

Therefore, its fully qualified DNS name is:

```text
webnote-1.webnote.dso202-practical-02.svc.cluster.local
```

The objects/components required are:

1. StatefulSet `webnote`
2. Pod `webnote-1`
3. Headless Service `webnote`
4. Namespace `dso202-practical-02`
5. Cluster DNS service

The StatefulSet's `serviceName` connects the StatefulSet to the headless Service.

## 4.5 What happened to the claims when the StatefulSet was scaled?

When the StatefulSet was scaled from three to four replicas, a new claim was created for ordinal 3:

```text
content-webnote-3
```

When it was scaled from four to two replicas, the higher ordinal Pods were terminated first.

The claims remained because the StatefulSet's PVC retention policy retained them.

When the StatefulSet was later scaled back to three replicas, ordinal 2 reused its existing claim and therefore regained its previous stored data.

The important relationship is:

```text
ordinal → Pod identity → PVC identity → persistent data
```

## 4.6 Why does PostgreSQL mount the volume at `/var/lib/postgresql`?

The PostgreSQL 18 image uses a version-specific data directory below `/var/lib/postgresql`.

The volume is therefore mounted at the parent directory rather than directly replacing the database's data directory.

Mounting directly over a non-empty database data directory can hide the image's expected directory contents and can cause PostgreSQL initialisation to fail on storage backends where the mounted volume is not empty.

## 4.7 What does a StatefulSet not provide?

A StatefulSet provides stable identity and persistent storage association, but it does not itself provide database replication.

Database replication must be provided by the database software or an appropriate database Operator.

A StatefulSet also does not provide backup.

A separate backup mechanism such as logical database dumps, snapshots, or an application/database backup system is required.

The `tasktracker-dump.sql` generated during this practical is an example of a logical backup.

## 4.8 Why did the Retain PV become Released rather than Available?

After the PVC was deleted, the Retain PV still contained data associated with the previous workload.

Kubernetes therefore placed the PV in the:

```text
Released
```

phase rather than making it immediately available for another claim.

An administrator must deliberately reclaim or clean the underlying storage and reset/recreate the PV before returning the storage to service.

This prevents another workload from accidentally receiving another workload's existing data.

# 5. Reflection

## 5.1 Difficult Part

The most difficult part of the practical was understanding why the dynamically provisioned PVC remained Pending before
the writer Pod was created was initially confusing.

## 5.2 Error Encountered

The actual error encountered during the practical was error from server (Forbidden) when attempting to increase the PVC size.

The cause was that the rejection comes from the API server, not from the provisioner and it is caused by allowVolumeExpansion: false on the class. The resize operation was rejected because volume expansion was disabled for the StorageClass.

## 5.3 What I Would Do Differently

If I repeated the practical, I would organise the evidence directory before beginning each stage and capture the required command output immediately after each important experiment. This would make it easier to associate screenshots and command outputs with the correct stage.

I would also check the StorageClass configuration before troubleshooting a PVC because fields such as `volumeBindingMode`, `reclaimPolicy` and `allowVolumeExpansion` directly affect the behaviour observed during the practical.

## 5.4 One Remaining Unclear Point

One aspect that remains unclear to me is how the behaviour of the local-path provisioner differs internally from a CSI-based network storage provisioner when a Pod is rescheduled to another.

# 6. References

1. DSO202 Practical 2 Guide.

2. DSO202 Practical 2 manifest file.

