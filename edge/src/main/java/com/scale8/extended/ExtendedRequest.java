package com.scale8.extended;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.scale8.Env;
import com.scale8.extended.collectors.TupleCollector;
import com.scale8.extended.types.Tuple;
import com.scale8.mmdb.Geo;
import io.micronaut.http.HttpHeaders;
import io.micronaut.http.HttpRequest;
import org.apache.commons.codec.binary.Hex;
import ua_parser.Client;
import ua_parser.Parser;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

public class ExtendedRequest {

  final Env env;
  final Geo geo;

  final HttpRequest<String> request;
  final Map<String, String> allParameters;
  final String id;

  public ExtendedRequest(HttpRequest<String> request, Env env, Geo geo, String id) {
    this.env = env;
    this.geo = geo;
    this.request = request;
    this.allParameters = getParametersAsMap();
    this.id = id;
  }

  public ExtendedRequest(
      HttpRequest<String> request,
      Env env,
      Geo geo,
      String id,
      Map<String, String> extraParameters) {
    this.env = env;
    this.geo = geo;
    this.request = request;
    this.allParameters =
        Stream.of(extraParameters, getParametersAsMap())
            .flatMap(m -> m.entrySet().stream())
            .map(m -> new Tuple<>(m.getKey(), m.getValue()))
            .collect(new TupleCollector<>());
    this.id = id;
  }

  private Map<String, String> getParametersAsMap() {
    return Streamable.iteratorToStream(request.getParameters().iterator())
        .map(p -> new Tuple<>(p.getKey(), p.getValue().isEmpty() ? "" : p.getValue().get(0)))
        .collect(new TupleCollector<>());
  }

  public String getHost() {
    if (id != null) {
      return (env.IS_PROD ? "p" : "d") + id + ".scale8.com";
    } else {
      return request.getServerName();
    }
  }

  public String getId() {
    return id;
  }

  public boolean usingHostRouting() {
    return id == null;
  }

  public String getCountryCode() {
    return geo.getCountryCode(getClientAddressAsString());
  }

  public HttpRequest<String> getRequest() {
    return this.request;
  }

  public Map<String, String> getAllParameters() {
    return allParameters;
  }

  public Optional<JsonObject> getJSONPayload() {
    if (request.getMethodName().equals("POST")) {
      return asJsonObject();
    } else {
      String data = request.getParameters().get("d");
      return data == null
          ? Optional.empty()
          : Optional.of(new Gson().fromJson(data, JsonObject.class));
    }
  }

  public Optional<JsonElement> asJsonElement() {
    Optional<String> body = request.getBody();
    if (body.isEmpty()) {
      return Optional.empty();
    } else {
      return Optional.of(new Gson().fromJson(body.get(), JsonElement.class));
    }
  }

  public Optional<JsonObject> asJsonObject() {
    Optional<JsonElement> jsonElement = asJsonElement();
    return jsonElement.isPresent() && jsonElement.get().isJsonObject()
        ? Optional.of(jsonElement.get().getAsJsonObject())
        : Optional.empty();
  }

  public String getRequestingPage() {
    String url = request.getParameters().get("url");
    if (url == null) {
      return request.getHeaders().get(HttpHeaders.REFERER);
    } else {
      return url;
    }
  }

  public String getRevisionPreviewId() {
    return getAllParameters().get("preview");
  }

  public Client getUserAgent() {
    return new Parser().parse(request.getHeaders().get(HttpHeaders.USER_AGENT));
  }

  public String getUserAgentAsString() {
    return request.getHeaders().get(HttpHeaders.USER_AGENT);
  }

  public String getRequestingPageReferrer() {
    return request.getParameters().get("referrer");
  }

  public String getEvent() {
    return request.getParameters().get("event");
  }

  public Map<String, String> getRequestingPageUTMTracking() {
    return Streamable.iteratorToStream(request.getParameters().iterator())
        .filter((item) -> item.getKey().startsWith("utm_"))
        .flatMap(
            (item) ->
                item.getValue().isEmpty()
                    ? Stream.empty()
                    : Stream.of(new Tuple<>(item.getKey(), item.getValue().get(0))))
        .collect(new TupleCollector<>());
  }

  public String getClientAddressAsString() {
    HttpHeaders headers = request.getHeaders();
    if (headers.get("X-Forwarded-For") != null) {
      return headers.get("X-Forwarded-For");
    } else if (headers.get("X-ProxyUser-Ip") != null) {
      return headers.get("X-ProxyUser-Ip");
    } else if (headers.get("Remote-Address") != null) {
      return headers.get("Remote-Address");
    }
    return request.getRemoteAddress().toString();
  }

  public String getUserHash() {
    String date =
        LocalDateTime.now(ZoneId.of("UTC")).format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    try {
      return Hex.encodeHexString(
          MessageDigest.getInstance("SHA-256")
              .digest(
                  (date + getClientAddressAsString() + getUserAgentAsString())
                      .getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException noSuchAlgorithmException) {
      noSuchAlgorithmException.printStackTrace();
      return null;
    }
  }

  public int getUserDistributionValue() throws NoSuchAlgorithmException {
    String hash =
        Hex.encodeHexString(
            MessageDigest.getInstance("SHA-256")
                .digest(
                    (getClientAddressAsString() + getUserAgentAsString())
                        .getBytes(StandardCharsets.UTF_8)));
    String hashDigits = hash.replaceAll("\\D+", "");
    return Integer.parseInt(
        hashDigits.length() >= 3 ? hashDigits.substring(hashDigits.length() - 3) : hashDigits);
  }

  public String getServer() {
    String base = env.S8_ROOT_SERVER == null ? "https://" + getHost() : env.S8_ROOT_SERVER;
    if (id != null) {
      base += "/edge/" + id;
    }
    return base;
  }
}
