# Screen–Component Mapping

```mermaid
%%{init:{'theme':'base','themeVariables':{'background':'#060810','primaryColor':'#0c1a30','primaryTextColor':'#7dd3fc','primaryBorderColor':'#0e3a6e','edgeLabelBackground':'#0c1a30','lineColor':'#334155','secondaryColor':'#0f172a','clusterBkg':'#060c18','clusterBorder':'#1e3a5f','fontFamily':'JetBrains Mono','fontSize':'14'},'flowchart':{'nodeSpacing':40,'rankSpacing':24,'padding':8}}}%%
graph LR
  classDef ssr fill:#0d1a0d,stroke:#16a34a,color:#86efac
  classDef ctrl fill:#042f2e,stroke:#0d9488,color:#5eead4
  classDef csr fill:#2d1200,stroke:#c2410c,color:#fb923c
  classDef ssg fill:#1a0d1a,stroke:#7c3aed,color:#c4b5fd
  classDef isr fill:#1a1a0d,stroke:#ca8a04,color:#fde047
  classDef ppr fill:#0d1a2d,stroke:#2563eb,color:#93c5fd
  classDef unk fill:#1a1a1a,stroke:#6b7280,color:#9ca3af
  classDef pkg fill:#0c1018,stroke:#475569,color:#cbd5e1
  classDef ext fill:#2d1a06,stroke:#d97706,color:#fcd34d
  classDef muted fill:#0a0d14,stroke:#374151,color:#64748b,stroke-dasharray: 3 3
  classDef hdr fill:#06080f,stroke:#1e3a5f,color:#7dd3fc
  leaf_route_src_app_admin_page["admin · SSR<br/>🔗 /admin<br/>📂 src/app/admin<br/>📄 page.tsx"]:::ssr
  file_component_src_app_admin_AdminDashboardClient_tsx_AdminDashboardClient["📂 src/app/admin<br/>📄 AdminDashboardClient.tsx"]:::pkg
  subgraph AUTH_T["🔐 /auth"]
    leaf_route_src_app_auth_login_page["login · CSR<br/>🔗 /auth/login<br/>📂 src/app/auth/login<br/>📄 page.tsx"]:::csr
    leaf_route_src_app_auth_reset_password_page["reset-password · CSR<br/>🔗 /auth/reset-password<br/>📂 src/app/auth/reset-password<br/>📄 page.tsx"]:::csr
    leaf_route_src_app_auth_update_password_page["update-password · CSR<br/>🔗 /auth/update-password<br/>📂 src/app/auth/update-password<br/>📄 page.tsx"]:::csr
    leaf_route_src_app_auth_verify_email_page["verify-email · CSR<br/>🔗 /auth/verify-email<br/>📂 src/app/auth/verify-email<br/>📄 page.tsx"]:::csr
  end
  leaf_route_src_app_auth_login_page ~~~ leaf_route_src_app_auth_reset_password_page ~~~ leaf_route_src_app_auth_update_password_page ~~~ leaf_route_src_app_auth_verify_email_page
  subgraph CARS_T["📄 /cars"]
    route_src_app_cars_page["cars · SSR<br/>🔗 /cars"]:::ssr
    file_component_src_app_cars_page_tsx_page["📂 src/app/cars<br/>📄 page.tsx"]:::pkg
    route_src_app_cars_page --> file_component_src_app_cars_page_tsx_page
    file_component_src_components_cars_CarListing_tsx_CarListing["📂 src/components/cars<br/>📄 CarListing.tsx"]:::pkg
    leaf_route_src_app_cars__id__page[":id · SSR<br/>🔗 /cars/:id<br/>📂 src/app/cars/[id]<br/>📄 page.tsx"]:::ssr
    file_component_src_components_cars_CarDetailActions_tsx_CarDetailActions["📂 src/components/cars<br/>📄 CarDetailActions.tsx"]:::pkg
    file_component_src_components_cars_CarImageGallery_tsx_CarImageGallery["📂 src/components/cars<br/>📄 CarImageGallery.tsx"]:::pkg
    file_component_src_components_cars_ReviewSection_tsx_ReviewSection["📂 src/components/cars<br/>📄 ReviewSection.tsx"]:::pkg
  end
  subgraph CHECKOUT_T["📄 /checkout"]
    route_src_app_checkout_page["checkout · SSR<br/>🔗 /checkout"]:::ssr
    file_component_src_app_checkout_page_tsx_page["📂 src/app/checkout<br/>📄 page.tsx"]:::pkg
    route_src_app_checkout_page --> file_component_src_app_checkout_page_tsx_page
    file_component_src_components_checkout_CheckoutClient_tsx_CheckoutClient["📂 src/components/checkout<br/>📄 CheckoutClient.tsx"]:::pkg
    leaf_route_src_app_checkout_success_page["success · SSR<br/>🔗 /checkout/success<br/>📂 src/app/checkout/success<br/>📄 page.tsx"]:::ssr
    file_component_src_components_checkout_CheckoutSuccessClient_tsx_CheckoutSuccessClient["📂 src/components/checkout<br/>📄 CheckoutSuccessClient.tsx"]:::pkg
  end
  subgraph CONTRACT_T["📄 /contract"]
    route_src_app_contract_page["contract · SSR<br/>🔗 /contract"]:::ssr
    file_component_src_app_contract_page_tsx_page["📂 src/app/contract<br/>📄 page.tsx"]:::pkg
    route_src_app_contract_page --> file_component_src_app_contract_page_tsx_page
    file_component_src_components_contract_ContractClient_tsx_ContractClient["📂 src/components/contract<br/>📄 ContractClient.tsx"]:::pkg
    leaf_route_src_app_contract_sent_page["sent · SSR<br/>🔗 /contract/sent<br/>📂 src/app/contract/sent<br/>📄 page.tsx"]:::ssr
  end
  leaf_route_src_app_lease_page["lease · CSR<br/>🔗 /lease<br/>📂 src/app/lease<br/>📄 page.tsx"]:::csr
  file_component_src_components_providers_user_session_provider_tsx_UserSessionProvider["📂 src/components/providers<br/>📄 user-session-provider.tsx"]:::pkg
  file_component_src_components_providers_app_ui_provider_tsx_AppUIProvider["📂 src/components/providers<br/>📄 app-ui-provider.tsx"]:::pkg
  subgraph MY_BOOKINGS_T["📄 /my-bookings"]
    route_src_app_my_bookings_page["my-bookings · SSR<br/>🔗 /my-bookings"]:::ssr
    file_component_src_app_my_bookings_page_tsx_page["📂 src/app/my-bookings<br/>📄 page.tsx"]:::pkg
    route_src_app_my_bookings_page --> file_component_src_app_my_bookings_page_tsx_page
    file_component_src_components_booking_MyBookingsClient_tsx_MyBookingsClient["📂 src/components/booking<br/>📄 MyBookingsClient.tsx"]:::pkg
    leaf_route_src_app_my_bookings__id__page[":id · SSR<br/>🔗 /my-bookings/:id<br/>📂 src/app/my-bookings/[id]<br/>📄 page.tsx"]:::ssr
  end
  leaf_route_src_app_my_leases_page["my-leases · SSR<br/>🔗 /my-leases<br/>📂 src/app/my-leases<br/>📄 page.tsx"]:::ssr
  route_src_app_page["/ · SSR<br/>🔗 /"]:::ssr
  file_component_src_app_page_tsx_page["📂 src/app<br/>📄 page.tsx"]:::pkg
  route_src_app_page --> file_component_src_app_page_tsx_page
  file_component_src_components_landing_HeroSearch_tsx_HeroSearch["📂 src/components/landing<br/>📄 HeroSearch.tsx"]:::pkg
  file_component_src_components_landing_AboutSection_tsx_AboutSection["📂 src/components/landing<br/>📄 AboutSection.tsx"]:::pkg
  file_component_src_components_landing_ServicesSection_tsx_ServicesSection["📂 src/components/landing<br/>📄 ServicesSection.tsx"]:::pkg
  file_component_src_components_landing_OffersCtaSection_tsx_OffersSection["📂 src/components/landing<br/>📄 OffersCtaSection.tsx"]:::pkg
  file_component_src_components_landing_FeaturedFleet_tsx_FeaturedFleet["📂 src/components/landing<br/>📄 FeaturedFleet.tsx"]:::pkg
  file_component_src_components_landing_ContactSection_tsx_ContactSection["📂 src/components/landing<br/>📄 ContactSection.tsx"]:::pkg
  file_component_src_components_motion_Reveal_tsx_Reveal["📂 src/components/motion<br/>📄 Reveal.tsx"]:::pkg
  file_component_src_components_landing_VerifiedBanner_tsx_VerifiedBanner["📂 src/components/landing<br/>📄 VerifiedBanner.tsx"]:::pkg
  leaf_route_src_app_services_page["services · SSR<br/>🔗 /services<br/>📂 src/app/services<br/>📄 page.tsx"]:::ssr
  leaf_route_src_app_admin_page ~~~ AUTH_T ~~~ CARS_T ~~~ CHECKOUT_T ~~~ CONTRACT_T ~~~ leaf_route_src_app_lease_page ~~~ MY_BOOKINGS_T ~~~ leaf_route_src_app_my_leases_page ~~~ leaf_route_src_app_services_page
  leaf_route_src_app_admin_page --> file_component_src_app_admin_AdminDashboardClient_tsx_AdminDashboardClient
  file_component_src_app_cars_page_tsx_page --> file_component_src_components_cars_CarListing_tsx_CarListing
  leaf_route_src_app_cars__id__page --> file_component_src_components_cars_CarDetailActions_tsx_CarDetailActions
  leaf_route_src_app_cars__id__page --> file_component_src_components_cars_CarImageGallery_tsx_CarImageGallery
  leaf_route_src_app_cars__id__page --> file_component_src_components_cars_ReviewSection_tsx_ReviewSection
  file_component_src_app_checkout_page_tsx_page --> file_component_src_components_checkout_CheckoutClient_tsx_CheckoutClient
  leaf_route_src_app_checkout_success_page --> file_component_src_components_checkout_CheckoutSuccessClient_tsx_CheckoutSuccessClient
  file_component_src_app_contract_page_tsx_page --> file_component_src_components_contract_ContractClient_tsx_ContractClient
  leaf_route_src_app_lease_page --> file_component_src_components_providers_user_session_provider_tsx_UserSessionProvider
  leaf_route_src_app_lease_page --> file_component_src_components_providers_app_ui_provider_tsx_AppUIProvider
  file_component_src_app_my_bookings_page_tsx_page --> file_component_src_components_booking_MyBookingsClient_tsx_MyBookingsClient
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_HeroSearch_tsx_HeroSearch
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_AboutSection_tsx_AboutSection
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_ServicesSection_tsx_ServicesSection
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_OffersCtaSection_tsx_OffersSection
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_FeaturedFleet_tsx_FeaturedFleet
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_ContactSection_tsx_ContactSection
  file_component_src_app_page_tsx_page --> file_component_src_components_motion_Reveal_tsx_Reveal
  file_component_src_app_page_tsx_page --> file_component_src_components_landing_VerifiedBanner_tsx_VerifiedBanner
```
