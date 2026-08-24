# DSO202 — Practical_1 Report

## Setting Up a Local Kubernetes Cluster with kind and Deploying First Workloads

**Module:** DSO202 — Scaling, Orchestration, Monitoring & Observability  
**Programme:** BE in Software Engineering  
**Practical:** 01 of 10  
**Selected Tool:** kind (Kubernetes IN Docker)  
**Student Name:** Tshering Phuntsho  
**Student Number:** 02230310   
**Date:** 18 August, 2026

## 1. Objective

The objective of this practical was to set up and operate a local Kubernetes environment using **kind** and to gain practical experience with the core Kubernetes objects.

The practical involved creating a three node Kubernetes cluster consisting of one control-plane node and two worker nodes. After creating the cluster, I inspected the Kubernetes control-plane components, created a namespace with resource controls, deployed an Nginx web application using both imperative and declarative approaches and managed the application through Pods, Deployments, ReplicaSets and Services.

The practical addresses the following learning outcomes:

- **LO1:** Understand the core concepts and architecture of Kubernetes.
- **LO2:** Deploy and manage applications on a Kubernetes cluster using different resource types.
- **LO3:** Operate the Kubernetes CLI (`kubectl`) for cluster management and troubleshooting.
- **LO5 (part):** Apply namespace-based multi-tenancy concepts.

## 2. Environment

The practical was completed on a local machine using Docker as the container runtime and kind to create the Kubernetes cluster.

| Component | Version / Details |
|---|---|
| Operating System | **Pop!_OS 22.04 LTS** |
| Docker | **v29.2.1** |
| kind | **v0.32.0** |
| kubectl | **v1.36** |
| Kubernetes cluster | **v1.36.1** |
| Cluster name | `dso202` |
| Nodes | 1 control-plane + 2 workers |
| Container image used | `nginx:1.30-alpine` |
| Working namespace | `dso202-practical` |

# 3. Procedure and Observations

## 3.1 Stage 0 — Prerequisites and Verification

Before creating the Kubernetes cluster, I verified that the required software was installed and working. The main tools were Docker, kind and kubectl.

The Docker daemon was checked first because kind uses Docker containers as Kubernetes nodes. I then verified the installed versions of kind and kubectl.

### Commands used

```bash
docker info --format '{{.ServerVersion}} {{.OperatingSystem}}'
kind version
kubectl version --client
```

### Observation

All required tools were available and responding correctly. This confirmed that the environment was ready for creating the Kubernetes cluster.

![environment verification](/dso202-practical-01/evidence/environmentVerification-stage0.png)

## 3.2 Stage 1 — Creating the Three-Node Cluster

I created a three-node Kubernetes cluster named `dso202` using the supplied kind configuration. The cluster contained one control-plane node and two worker nodes.

The cluster configuration was stored in:

```text
cluster/kind-cluster.yaml
```
![cluster creation](/dso202-practical-01/evidence/creatingCluster-stage1.png)

### Commands used

```bash
kind create cluster --config cluster/kind-cluster.yaml

kind get clusters
kind get nodes --name dso202

docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'

kubectl config current-context
```

### Observation

The kind cluster was successfully created and the three Docker containers representing the Kubernetes nodes were running:

- `dso202-control-plane`
- `dso202-worker`
- `dso202-worker2`

The kubectl context was automatically changed to:

```text
kind-dso202
```
![cluster creation](/dso202-practical-01/evidence/2-stage1.png)

This demonstrated that kind runs Kubernetes nodes as containers while Kubernetes exposes them as Node objects to the cluster.

![cluster creation](/dso202-practical-01/evidence/1-stage1.png)

## 3.3 Stage 2 — Inspecting the Cluster and Its Components

After creating the cluster, I inspected the cluster status and its internal components.

### Commands used

```bash
kubectl cluster-info
kubectl get nodes
kubectl get nodes -o wide
kubectl describe node worker-node-1
kubectl get namespaces
kubectl get pods -n kube-system -o wide
kubectl logs -n kube-system kube-scheduler-control-plane --tail=10
```

### Observation

All three Kubernetes nodes reported a `Ready` status. The control-plane node contained the main control-plane components, while components such as `kube-proxy` and the kind networking component were present across the nodes.

The inspection of `kube-system` showed components including:

- `etcd`
- `kube-apiserver`
- `kube-controller-manager`
- `kube-scheduler`
- `kube-proxy`
- CoreDNS
- kind networking components

The node description also showed labels, capacity, allocatable resources and the Pods scheduled on the node.

This stage helped connect the theoretical Kubernetes architecture with the actual objects and Pods running in the cluster.

![nodes](/dso202-practical-01/evidence/nodes-stage2.png)

![kubernetes component](/dso202-practical-01/evidence/kubernetesComponent-stage2.png) 

## 3.4 Stage 3 — Namespace, ResourceQuota and LimitRange

I have created the namespace imperatively first to see the imperative form, then deleted it.

![imperative](/dso202-practical-01/evidence/imperativeFirst-stage3.png)

Generated a manifest from an imperative command without executing it.

![manisfest](/dso202-practical-01/evidence/manifet-stage3.png)

I created a dedicated namespace named `dso202-practical` to isolate the resources used in this practical.

The namespace configuration was stored in:

```text
manifests/00-namespace.yaml
```
![namespace](/dso202-practical-01/evidence/listing20stage3.png)

I then applied a ResourceQuota and LimitRange from:

```text
manifests/01-quota-and-limits.yaml
```
![namespace](/dso202-practical-01/evidence/listing3stage3.png)

### Commands used

```bash
kubectl apply -f manifests/00-namespace.yaml

kubectl config set-context --current --namespace=dso202-practical

kubectl apply -f manifests/01-quota-and-limits.yaml

kubectl describe resourcequota dso202-quota
kubectl describe limitrange dso202-limits
```

### Observation

The ResourceQuota limited the total resource consumption and object counts within the namespace. The configured limits included CPU, memory, Pods, Services, ConfigMaps and Secrets.

The LimitRange supplied default resource requests and limits for containers that did not explicitly define them.

To verify this behaviour, I created a temporary Pod without resource declarations:

```bash
kubectl run limitrange-check --image=nginx:1.30-alpine --restart=Never
kubectl get pod limitrange-check -o jsonpath='{.spec.containers[0].resources}'
```

The resulting resource configuration showed that default values had been automatically injected.

![temporary](/dso202-practical-01/evidence/temporary-Stage3.png)

The temporary Pod was then removed:

```bash
kubectl delete pod limitrange-check
```

This demonstrated how ResourceQuota and LimitRange work together to control resource usage in a namespace.

## 3.5 Stage 4 — Pods

### 3.5.1 Imperative Pod

I first created a Pod using the imperative `kubectl run` command.

```bash
kubectl run web-imperative \
  --image=nginx:1.30-alpine \
  --restart=Never \
  --port=80 \
  --labels='app=web,tier=frontend,managed-by=imperative' --namespace dso202-practical-01
```

I verified that the Pod reached the `Running` state and captured its stored YAML:

```bash
kubectl get pod web-imperative --watch --namespace dso202-practical-01

kubectl get pod web-imperative -o yaml > evidence/web-imperative-as-stored.yaml
```

The Pod was then deleted:

```bash
kubectl delete pod web-imperative
```
![imperative](/dso202-practical-01/evidence/imperativeRoute-Stage4.png)

### 3.5.2 Declarative Pod

I created the required Pod using the manifest:

```text
manifests/02-pod-web.yaml
```

and applied it with:

```bash
kubectl apply -f manifests/02-pod-web.yaml
```

Applying the same manifest again produced an `unchanged` result, demonstrating declarative configuration.

```bash
kubectl apply -f manifests/02-pod-web.yaml
```
![declarative](/dso202-practical-01/evidence/declarative-stage4.png)

### 3.5.3 Labels and Selectors

I inspected and queried the Pod using labels:

```bash
kubectl get pod web-pod -o wide --show-labels
kubectl get pods -l app=web
kubectl get pods -l tier=frontend,dso202/managed-by=declarative
```

I also added and removed a label at runtime and added an annotation.

![labels](/dso202-practical-01/evidence/labels-stage4.png)

### 3.5.4 Troubleshooting and Container Access

I used the following commands to inspect and troubleshoot the running Pod:

```bash
kubectl describe pod web-pod
kubectl logs web-pod --tail=5
kubectl exec -it web-pod -- sh
kubectl exec web-pod -- nginx -v
```

Inside the container, I checked the hostname, operating system information, Nginx document directory and local HTTP response.

I also used port forwarding:

```bash
kubectl port-forward pod/web-pod 8080:80
```
![portForward](/dso202-practical-01/evidence/port-forwarding-stage4.png)

Leaving that command running, in a second terminal I tested the web server from the host:

```bash
curl -s http://localhost:8080
```
![curl](/dso202-practical-01/evidence/curl-tested-stage4.png)

### Observation

The Pod reached the `Running` state and successfully served the default Nginx web page. The `describe` output showed the scheduling and container startup events. The exercise also demonstrated that Pod IP addresses are cluster internal and that port forwarding can be used for temporary debugging access.


## 3.6 Stage 5 — Deployments

I created a Deployment using:

```text
manifests/03-deployment-web.yaml
```

The Deployment managed three replicas of the Nginx application.

### Commands used

```bash
kubectl apply -f manifests/03-deployment-web.yaml
kubectl rollout status deployment/web-deployment

kubectl get deployment,replicaset,pod -l app=web
```
![deployment](/dso202-practical-01/evidence/deployment-stage5.png)

### Observation

The Deployment created a ReplicaSet, which in turn created three Pods. This demonstrated the Kubernetes ownership chain:

```text
Deployment
    |
    v
ReplicaSet
    |
    v
Pods
```

The scheduler placed the Pods on the available worker nodes without a node being explicitly specified in the Deployment manifest.

### Self-healing

I deleted one of the Pods:

```bash
victim=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl delete pod "$victim"
kubectl get pods -l app=web
```
![self-healing](/dso202-practical-01/evidence/self-healing-stage5.png)

A replacement Pod was automatically created by the ReplicaSet.

### Scaling

I scaled the Deployment to five replicas imperatively:

```bash
kubectl scale deployment web-deployment --replicas=5
kubectl get deployment web-deployment
```
I then return to three replicas the declarative way by applying the manifest again.

```bash
kubectl apply -f manifests/03-deployment-web.yaml
kubectl get deployment web-deployment
```
![imperative scaling](/dso202-practical-01/evidence/scaling-stage5.png)

### Rolling Update

I changed the Nginx image to a newer version. Watch the rollout in a second terminal:

```bash
kubectl get pods -l app=web --watch
```
![watch](/dso202-practical-01/evidence/beforeUpdate-stage5.png)

I changed the image version to `nginx:1.31-alpine` from `nginx:1.30-alpine`(current used).

```bash
kubectl set image deployment/web-deployment web=nginx:1.31-alpine
kubectl annotate deployment web-deployment \
  kubernetes.io/change-cause="upgrade nginx from 1.30-alpine to 1.31-alpine"
kubectl rollout status deployment/web-deployment
```
![version](/dso202-practical-01/evidence/versionchanged-stage5.png)

The Deployment created a new ReplicaSet and gradually replaced the old Pods.

![rollout](/dso202-practical-01/evidence/afterrollout-stage5.png)

### Rollback

I inspected the revision history:

```bash
kubectl rollout history deployment/web-deployment
```

and rolled back to the previous version:

```bash
kubectl rollout undo deployment/web-deployment
kubectl rollout status deployment/web-deployment
kubectl get deployment web-deployment -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```
![rollback](/dso202-practical-01/evidence/rollback-stage5.png)

The image was restored to:

```text
nginx:1.30-alpine
```

### Failed Rollout

I deliberately changed the image to a nonexistent version:

```bash
kubectl set image deployment/web-deployment web=nginx:9.99-does-not-exist
kubectl rollout status deployment/web-deployment --timeout=60s
kubectl get pods -l app=web
```
![imagePullBackOff](/dso202-practical-01/evidence/failrollback-stage5.png)
The new Pod entered `ImagePullBackOff`, while the existing healthy Pods remained available. I diagnosed the problem using Pod status and description, then recovered the application using:

```bash
kubectl describe pod -l app=web | grep -A3 'Failed'
kubectl rollout undo deployment/web-deployment
kubectl rollout status deployment/web-deployment
kubectl get pods -l app=web
```
![recovered](/dso202-practical-01/evidence/recovered-stage5.png)

Finally, I restored the manifest-defined state:

```bash
kubectl apply -f manifests/03-deployment-web.yaml
kubectl diff -f manifests/03-deployment-web.yaml && echo "cluster matches manifest"
```
![restored](/dso202-practical-01/evidence/restored-stage5.png)

### Observation

This stage demonstrated the major advantage of Deployments over standalone Pods: self-healing, replica management, controlled updates and rollback. The failed rollout also showed the importance of a safe rollout strategy because the healthy replicas remained available while the invalid image failed to start.


## 3.7 Stage 6 — Services

Because Pod IP addresses are temporary, I created Services to provide stable access to the Nginx application.

### ClusterIP Service

The ClusterIP Service was created using:

```text
manifests/04-service-clusterip.yaml
```

```bash
kubectl apply -f manifests/04-service-clusterip.yaml
kubectl get service web-clusterip
kubectl get endpointslice -l kubernetes.io/service-name=web-clusterip
```

The EndpointSlice contained the addresses of the ready web Pods.

### Internal DNS Test

I created a client Pod and tested DNS resolution from inside the cluster:

```bash
kubectl apply -f manifests/06-pod-client.yaml
kubectl wait --for=condition=Ready pod/client-pod --timeout=60s

kubectl exec client-pod -- nslookup web-clusterip
```

The Service name resolved to the ClusterIP rather than directly to a Pod IP.

### NodePort Service

I then created a NodePort Service using:

```text
manifests/05-service-nodeport.yaml
```

```bash
kubectl apply -f manifests/05-service-nodeport.yaml
kubectl get service
```

The NodePort was configured to use port `30080`.

I tested the application from the host machine:

```bash
curl -s http://localhost:30080
```

Repeated requests returned responses from the Nginx Deployment Pods, demonstrating Service load balancing.

I also tested the NodePort from inside a worker-node container:

```bash
docker exec dso202-worker curl -s http://localhost:30080
```

### LoadBalancer Behaviour

I also tested a temporary LoadBalancer Service:

```bash
kubectl create service loadbalancer lb-demo --tcp=80:80
kubectl get service lb-demo
kubectl delete service lb-demo
```

The `EXTERNAL-IP` remained `<pending>` because a local kind cluster does not have a cloud-provider load balancer.

### Observation

The Service exercises demonstrated the difference between ClusterIP and NodePort:

- **ClusterIP** provides stable internal access within the cluster.
- **NodePort** exposes the Service through a port on every Kubernetes node.
- A **LoadBalancer** Service requires an external provider and therefore remains pending in the local kind environment.

> **Screenshot Placeholder — Stage 6: ClusterIP**  
> Insert the screenshot showing the ClusterIP Service and EndpointSlice.

> **Screenshot Placeholder — Stage 6: DNS**  
> Insert the screenshot showing `nslookup web-clusterip` from `client-pod`.

> **Screenshot Placeholder — Stage 6: NodePort**  
> Insert the screenshot showing `kubectl get service` with the NodePort.

> **Screenshot Placeholder — Stage 6: External Access**  
> Insert the screenshot showing `curl http://localhost:30080` returning the Nginx response.

> **Screenshot Placeholder — Stage 6: LoadBalancer**  
> Insert the screenshot showing the temporary LoadBalancer Service with `<pending>`.

## 3.8 Stage 7 — Cleanup and Reproducibility

Before deleting the cluster, I captured the final state of the Kubernetes resources and events.

### Commands used

```bash
kubectl get all -o wide > evidence/final-state-all.txt
kubectl get resourcequota,limitrange,endpointslice -o wide >> evidence/final-state-all.txt
kubectl get nodes -o wide > evidence/final-state-nodes.txt
kubectl get events --sort-by=.lastTimestamp > evidence/final-state-events.txt
```

The workload objects were then removed using their original manifests:

```bash
kubectl delete -f manifests/06-pod-client.yaml
kubectl delete -f manifests/05-service-nodeport.yaml
kubectl delete -f manifests/04-service-clusterip.yaml
kubectl delete -f manifests/03-deployment-web.yaml
kubectl delete -f manifests/02-pod-web.yaml
```

I verified that the namespace no longer contained workload resources:

```bash
kubectl get all
```

The configuration was then rebuilt from the repository:

```bash
kubectl apply -f manifests/
kubectl get all
```

This confirmed that the practical could be recreated from the stored manifests.

Finally, I reset the kubectl namespace and deleted the kind cluster:

```bash
kubectl config set-context --current --namespace=default

kind delete cluster --name dso202
kind get clusters
docker ps
```

### Observation

The cluster was successfully deleted, demonstrating that the practical configuration was stored in the repository rather than depending on the local cluster state. Reapplying the manifests recreated the Kubernetes workload objects, demonstrating reproducibility.

> **Screenshot Placeholder — Stage 7: Reproducibility**  
> Insert the screenshot showing `kubectl apply -f manifests/` recreating the resources.

> **Screenshot Placeholder — Stage 7: Cleanup**  
> Insert the screenshot showing the cluster deletion and `kind get clusters` reporting no remaining clusters.

# 4. Analysis

## 4.1 Why is a Deployment preferred over creating Pods directly?

A standalone Pod is not automatically recreated if it is deleted or if its node fails. A Deployment provides a controller that maintains the desired number of replicas through a ReplicaSet. It also provides controlled rolling updates and rollback functionality.

During this practical, deleting a Deployment-managed Pod caused a replacement Pod to be created automatically. This demonstrated Kubernetes reconciliation in practice.

## 4.2 What is the relationship between a Deployment, ReplicaSet and Pod?

The Deployment manages a ReplicaSet, and the ReplicaSet manages the Pods.

```text
Deployment
    ↓
ReplicaSet
    ↓
Pods
```

The Deployment controls the desired application state and rollout history. The ReplicaSet maintains the required number of replicas. The Pods run the actual containers.

## 4.3 Why are labels and selectors important?

Labels provide metadata that identifies Kubernetes objects. Selectors allow other Kubernetes objects, such as Deployments and Services, to find the correct Pods.

For example:

```text
app=web
```

was used to identify the web application Pods.

A Service does not depend on a Pod name or Pod IP. Instead, it uses a selector to dynamically find matching ready Pods.

## 4.4 What is the purpose of a ResourceQuota?

A ResourceQuota limits the aggregate amount of resources and selected Kubernetes objects that can be consumed by a namespace.

For example, the practical quota restricted CPU, memory, Pods and Services. This is useful in multi-user or multi-team environments because one namespace cannot consume unlimited cluster resources.

## 4.5 What is the purpose of a LimitRange?

A LimitRange provides default resource requests and limits and can also enforce minimum and maximum values for containers.

In this practical, a Pod created without resource declarations automatically received CPU and memory requests and limits from the LimitRange.

Therefore, the LimitRange helped satisfy the resource requirements imposed by the ResourceQuota.

## 4.6 Why should Pod IP addresses not be used as permanent application addresses?

Pod IP addresses are ephemeral. A Pod receives a new IP address when it is recreated, rescheduled or replaced during a rollout.

A Service provides a stable virtual IP and DNS name while dynamically forwarding traffic to the currently ready Pods.

Therefore, application clients should normally communicate with the Service rather than depending on an individual Pod IP.

## 4.7 What is the difference between ClusterIP and NodePort?

| Feature | ClusterIP | NodePort |
|---|---|---|
| Main purpose | Internal cluster access | External access through node ports |
| Default Service type | Yes | No |
| Accessible from cluster | Yes | Yes |
| Accessible from host/node port | No | Yes |
| Stable Service IP | Yes | Yes |
| Node port | No | Yes |

In this practical, the ClusterIP Service was used for internal DNS-based communication, while the NodePort Service allowed the Nginx application to be accessed through:

```text
http://localhost:30080
```

## 4.8 What happened during the failed Deployment rollout?

The Deployment was changed to use the nonexistent image:

```text
nginx:9.99-does-not-exist
```

The new Pod entered `ImagePullBackOff`. The existing healthy Pods remained available, so the application did not immediately lose all available replicas.

This demonstrated the benefit of a controlled rolling-update strategy. Instead of replacing all healthy Pods with broken Pods, Kubernetes kept the healthy replicas while the new version failed to become ready.

The problem was diagnosed from the Pod status and description, and the previous working version was restored using:

```bash
kubectl rollout undo deployment/web-deployment
```

## 4.9 Why did the LoadBalancer Service remain pending?

A `LoadBalancer` Service normally requests an external load balancer from a cloud or infrastructure provider. The local kind cluster does not provide such a cloud load-balancer implementation.

Therefore, the Service was created successfully but its `EXTERNAL-IP` remained:

```text
<pending>
```

This was expected behaviour rather than a Kubernetes failure.

## 4.10 Why is declarative configuration useful?

Declarative configuration describes the desired state rather than requiring every individual change to be performed manually.

For example:

```bash
kubectl apply -f manifests/03-deployment-web.yaml
```

can be repeated safely. If the live object already matches the manifest, Kubernetes reports that there is no required change.

The practical also demonstrated that manual imperative changes, such as scaling a Deployment, can be overwritten when the original manifest is applied again. This reinforces the importance of keeping the manifest as the source of truth.

# 5. Reflection

## 5.1 Difficulties Encountered

The most challenging part of the practical was understanding the relationship between Kubernetes objects and the actions performed by different controllers. Initially, it was easy to think of a Deployment as simply another way of creating Pods. However, observing the Deployment → ReplicaSet → Pod relationship made the controller model much clearer.

Another important learning point was understanding the difference between Pod networking and Service networking. A Pod IP may work inside the cluster but should not be treated as a permanent address. Using a Service and DNS name provides a more reliable communication mechanism.

The rolling-update exercise was also useful because it showed that an application can be deliberately given an invalid image without immediately destroying the healthy application replicas.

## 5.2 Error Diagnosis

During the failed rollout exercise, the Deployment was deliberately changed to a nonexistent image:

```text
nginx:9.99-does-not-exist
```

The rollout failed to complete and the new Pod entered `ImagePullBackOff`.

The diagnostic process was:

1. Check the Deployment rollout status.
2. Check the Pods using `kubectl get pods`.
3. Identify the `ImagePullBackOff` status.
4. Use `kubectl describe pod` to inspect the events and determine that the image could not be pulled.
5. Roll back the Deployment using `kubectl rollout undo`.
6. Verify that the original image was running again.
7. Reapply the declarative manifest to restore the intended state.

This showed that Kubernetes troubleshooting should begin with the current resource state and event history rather than immediately changing configuration.

## 5.3 What I Would Do Differently

If I repeated the practical, I would capture evidence immediately after every important checkpoint instead of collecting screenshots near the end. I would also keep a short command log while working so that the final report could be prepared more quickly.

I would additionally use `kubectl diff` before applying important manifest changes to compare the intended configuration with the current cluster state.

## 5.4 Remaining Area for Improvement

One area I still need to understand more deeply is how Kubernetes networking is implemented internally between Services, EndpointSlices, kube-proxy and the container network. The practical demonstrated the behaviour successfully, but the exact packet-processing path would benefit from further investigation in later networking and service-mesh practicals.

# 6. Conclusion

This practical provided a complete introduction to operating a local Kubernetes cluster using kind and kubectl. I successfully created a three-node cluster, inspected its architecture, configured namespace-level resource controls, deployed an Nginx workload, and managed it using Pods, Deployments, ReplicaSets and Services.

The practical also demonstrated important Kubernetes operational concepts including declarative configuration, scheduling, labels and selectors, self-healing, scaling, rolling updates, rollback, Service discovery, NodePort access and troubleshooting.

The failed rollout exercise was particularly useful because it demonstrated how Kubernetes protects healthy replicas during an unsuccessful update and how an administrator can diagnose and recover from the problem.

Finally, rebuilding the workload from the repository manifests demonstrated that the practical configuration was reproducible and not dependent solely on the original local cluster.

# 7. References

The following documentation and practical guide were used while completing the practical.

1. **DSO202 Practical 1 Guide — Setting Up a Local Kubernetes Cluster with kind and Deploying First Workloads.** Accessed: 16 August 2026.
2. **Kubernetes Documentation — kubectl documentation and Kubernetes concepts.** Accessed: 16 August 2026.
3. **kind Documentation — Kubernetes IN Docker.** Accessed: 16 August 2026.
4. **Docker Documentation — Docker Engine.** Accessed: 16 August 2026.

