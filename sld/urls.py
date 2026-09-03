from django.urls import path
from . import views

urlpatterns = [
    path('', views.editor_view, name='editor'),
    path('api/sld/<str:diagram_id>/', views.diagram_api, name='diagram_api'),
    path('api/sld/<str:diagram_id>/save/', views.save_diagram_api, name='save_diagram'),
    path('api/sld/<str:diagram_id>/telemetry/', views.telemetry_api, name='telemetry'),
    path('api/projects/create/', views.create_project_api, name='create_project'),
]
