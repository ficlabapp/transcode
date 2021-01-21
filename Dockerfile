FROM centos:7
RUN yum -y install psmisc epel-release;
RUN yum -y groupinstall Fonts;
RUN yum -y install \
    libXcomposite \
    libXrender \
    python36-qt5-base \
    caddy \
    supervisor \
    https://rpm.nodesource.com/pub_10.x/el/7/x86_64/nodejs-10.16.1-1nodesource.x86_64.rpm \
    https://rpm.nodesource.com/pub_10.x/el/7/x86_64/nodejs-devel-10.16.1-1nodesource.x86_64.rpm \
    https://rpm.nodesource.com/pub_10.x/el/7/x86_64/nodejs-docs-10.16.1-1nodesource.x86_64.rpm \
    ;
RUN curl -so /root/kindlegen.tar.gz https://mirror.erayd.net/kindlegen-v2.9-1028-0897292.tar.gz;
RUN \
    npm install -g yarn && \
    tar -C /usr/local/bin -zxf /root/kindlegen.tar.gz kindlegen  && \
    curl -s https://download.calibre-ebook.com/linux-installer.sh | bash /dev/stdin version=3.48.0 \
    ;
EXPOSE 8080/tcp
COPY etc/ /etc/
COPY srv/ /srv/
RUN yarn --cwd /srv install
ENTRYPOINT exec supervisord -c /etc/supervisord.conf -n
