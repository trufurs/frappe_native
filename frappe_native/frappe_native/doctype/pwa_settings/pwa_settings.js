// PWA Settings Form Script
frappe.ui.form.on("PWA Settings", {
	refresh(frm) {
		// Add custom button to generate VAPID keys
		if (frm.doc.enable_push_notifications && !frm.doc.vapid_public_key) {
			frm.add_custom_button(__("Generate VAPID Keys"), () => {
				frappe.call({
					doc: frm.doc,
					method: "generate_vapid_keys",
					callback: (r) => {
						if (r.message) {
							frappe.show_alert({
								message: __("VAPID keys generated successfully!"),
								indicator: "green",
							});
							frm.reload_doc();
						}
					},
				});
			}, __("Push Notifications"));
		}

		// Add a "Preview Manifest" button
		frm.add_custom_button(__("Preview Manifest"), () => {
			window.open("/api/method/frappe_native.api.manifest.get_manifest", "_blank");
		}, __("Actions"));

		// Add a "Test Offline Page" button
		frm.add_custom_button(__("Test Offline Page"), () => {
			window.open("/offline", "_blank");
		}, __("Actions"));

		// Show status indicators
		if (frm.doc.enable_pwa) {
			frm.dashboard.add_indicator(__("PWA Enabled"), "green");
		}
		if (frm.doc.enable_push_notifications && frm.doc.vapid_public_key) {
			frm.dashboard.add_indicator(__("Push Notifications Active"), "blue");

			// Show subscription count
			frappe.xcall("frappe.client.get_count", {
				doctype: "Push Subscription",
			}).then((count) => {
				frm.dashboard.add_indicator(
					__("{0} Push Subscriptions", [count]),
					"purple"
				);
			});
		}
		if (frm.doc.enable_offline_mode) {
			frm.dashboard.add_indicator(__("Offline Mode Enabled"), "orange");
		}
	},

	generate_vapid_keys_btn(frm) {
		frappe.call({
			doc: frm.doc,
			method: "generate_vapid_keys",
			callback: (r) => {
				if (r.message) {
					frappe.show_alert({
						message: __("VAPID keys generated successfully!"),
						indicator: "green",
					});
					frm.reload_doc();
				}
			},
		});
	},

	enable_push_notifications(frm) {
		if (frm.doc.enable_push_notifications && !frm.doc.vapid_public_key) {
			frappe.confirm(
				__("Push Notifications require VAPID keys. Generate them now?"),
				() => {
					frm.trigger("generate_vapid_keys_btn");
				}
			);
		}
	},
});
