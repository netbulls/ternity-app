dev.app.ternity.xyz {
	handle /api/* {
		reverse_proxy ternity-app-dev-api:3010
	}
	handle /health {
		reverse_proxy ternity-app-dev-api:3010
	}
	handle {
		reverse_proxy ternity-app-dev-web:80
	}
}

app.ternity.xyz {
	handle /api/* {
		reverse_proxy ternity-app-prod-api:3010
	}
	handle /health {
		reverse_proxy ternity-app-prod-api:3010
	}
	handle {
		reverse_proxy ternity-app-prod-web:80
	}
}
