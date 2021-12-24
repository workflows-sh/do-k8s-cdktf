# DigitalOcean K8s Demo Cluster Deployment
## Prerequisites
* export the following ENV vars on your machine (or provide the values in Provider config). These will need to be generated from the `Manage Keys->Spaces access Keys` section of the DigitalOcean Web UI:
    * `export SPACES_ACCESS_KEY_ID=7LAG***************VE2`
    * `export SPACES_SECRET_ACCESS_KEY=3za0**********************************UsEg`
* Terraform Cloud Workspace created and set to `local` execution mode. This is used as the remote state backend.
    * Alternatively, you can use local state (not recommended) by commenting/deleting the `RemoteBackend` config of the stack.
# do-k8s
