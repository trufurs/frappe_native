# Service Worker needs to be served from the root scope with correct content type
no_cache = 1


def get_context(context):
	context["content_type"] = "application/javascript"
