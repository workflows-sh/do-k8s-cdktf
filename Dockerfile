############################
# Final container
############################
FROM registry.cto.ai/official_images/node:2.7.4-12.13.1-buster-slim
RUN mkdir -p /usr/local/nvm
ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 16.19.1

RUN apt-get update && \
    apt-get install -y \
        python3 \
        python3-pip \
        python3-setuptools \
        groff \
        less \
        unzip \
        wget \
        jq \
    && pip3 install --upgrade pip

RUN curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.2/install.sh | bash
RUN . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# RUN wget https://releases.hashicorp.com/terraform/1.3.0/terraform_1.3.0_linux_386.zip -O terraform.zip
RUN wget https://releases.hashicorp.com/terraform/1.7.4/terraform_1.7.4_linux_amd64.zip -O terraform.zip
RUN unzip terraform.zip
RUN mv terraform /usr/local/bin/

# RUN wget https://github.com/digitalocean/doctl/releases/download/v1.66.0/doctl-1.66.0-linux-amd64.tar.gz
RUN wget https://github.com/digitalocean/doctl/releases/download/v1.101.0/doctl-1.101.0-linux-amd64.tar.gz -O doctl.tar.gz
RUN tar xf ./doctl.tar.gz
RUN mv ./doctl /usr/local/bin

RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
RUN install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

USER ops
WORKDIR /ops

ADD --chown=ops:9999 package.json .
ADD --chown=ops:9999 package-lock.json .
RUN npm install --loglevel=error

ADD --chown=ops:9999 . .

RUN npm run get && npm run synth

# RUN mkdir cdktf.out && chown ops:9999 cdktf.out
RUN chown ops:9999 cdktf.out
ADD --chown=ops:9999 ./credentials.tfrc.json /home/ops/.terraform.d/credentials.tfrc.json
ADD --chown=ops:9999 ./.terraform.d /home/ops/.terraform.d

RUN mkdir /home/ops/.kube && touch /home/ops/.kube/config
