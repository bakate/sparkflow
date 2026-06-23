FROM quay.io/keycloak/keycloak:26.0 AS builder

ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

WORKDIR /opt/keycloak

COPY infra/keycloak/sparkflow-realm.json /opt/keycloak/data/import/sparkflow-realm.json

RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.0

COPY --from=builder /opt/keycloak/ /opt/keycloak/

ENV KC_DB=postgres
ENV KC_HEALTH_ENABLED=true
ENV KC_HTTP_ENABLED=true
ENV KC_HTTP_HOST=0.0.0.0
ENV KC_METRICS_ENABLED=true
ENV KC_PROXY_HEADERS=xforwarded

ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--import-realm"]
