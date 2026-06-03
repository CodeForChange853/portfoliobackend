import json

STATUS_MAP = {
    200: '200 OK',
    201: '201 Created',
    204: '204 No Content',
    400: '400 Bad Request',
    401: '401 Unauthorized',
    403: '403 Forbidden',
    404: '404 Not Found',
    500: '500 Internal Server Error',
}


def json_response(start_response, cors_headers, data, status=200):
    headers = [h for h in cors_headers if h[0] != 'Content-Type']
    headers.append(('Content-Type', 'application/json'))
    start_response(STATUS_MAP.get(status, '200 OK'), headers)
    return [json.dumps(data).encode()]
