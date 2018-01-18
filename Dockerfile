FROM cs50/server
EXPOSE 8080

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y libmysqlclient-dev
COPY ./requirements.txt /tmp
RUN pip3 install -r /tmp/requirements.txt && rm -f /tmp/requirements.txt