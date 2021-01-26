FROM centos:8
RUN yum -y install psmisc epel-release;
RUN yum -y groupinstall Fonts;
RUN yum -y install \
    libXcomposite \
    libXrender \
    python3-qt5-base \
    liberation-fonts \
    nss \
    supervisor \
    nodejs \
    ;
RUN curl -so /root/kindlegen.tar.gz https://mirror.erayd.net/kindlegen-v2.9-1028-0897292.tar.gz;
RUN \
    npm install -g yarn && \
    tar -C /usr/local/bin -zxf /root/kindlegen.tar.gz kindlegen  && \
    curl -s https://download.calibre-ebook.com/linux-installer.sh | bash /dev/stdin version=5.10.1 \
    ;
EXPOSE 8080/tcp
COPY etc/ /etc/
COPY srv/ /srv/
RUN yarn --cwd /srv install
ENTRYPOINT exec supervisord -c /etc/supervisord.conf -n
