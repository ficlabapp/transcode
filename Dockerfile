FROM rockylinux:8
RUN dnf -y install psmisc epel-release;
RUN dnf -y groupinstall Fonts;
RUN dnf -y install \
    xz \
    nss \
    xdg-utils \
    libXcomposite \
    libXrender \
    libXdamage \
    libXrandr \
    libXi \
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
    curl -s https://download.calibre-ebook.com/linux-installer.sh | bash /dev/stdin version=5.44.0 \
    ;
EXPOSE 8080/tcp
COPY etc/ /etc/
COPY srv/ /srv/
RUN yarn --cwd /srv install
ENTRYPOINT exec supervisord -c /etc/supervisord.conf -n
