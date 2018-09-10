FROM alpine:3.7

ARG HUGO_VERSION

ENV AWSCLI_VERSION=1.15.49
ENV HUGO_VERSION ${HUGO_VERSION}

RUN apk add --no-cache --update \
  ca-certificates \
  curl \
  git \
  python3 \
  tree && \
  if [[ ! -e /usr/bin/pip ]]; then ln -s pip3 /usr/bin/pip ; fi && \
  if [[ ! -e /usr/bin/python ]]; then ln -sf /usr/bin/python3 /usr/bin/python; fi

RUN pip --no-cache-dir install awscli==${AWSCLI_VERSION}

RUN curl -sSL https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_${HUGO_VERSION}_Linux-64bit.tar.gz -o hugo_${HUGO_VERSION}_Linux-64bit.tar.gz \
 && tar zxvf hugo_${HUGO_VERSION}_Linux-64bit.tar.gz \
 && mv hugo /usr/local/bin/hugo \
 && rm -f hugo_${HUGO_VERSION}_Linux-64bit.tar.gz \
 && chmod +x /usr/local/bin/hugo

WORKDIR /website

CMD ["/bin/sh"]
