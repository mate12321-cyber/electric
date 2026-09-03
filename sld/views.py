import json
import random
from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from .models import SingleLineDiagram
from .seed_data import init_default_diagram, get_default_sld_schema

def editor_view(request):
    """Main SLD Editor & Viewer view."""
    default_diag = init_default_diagram()
    diagrams = SingleLineDiagram.objects.all().order_by('-updated_at')
    
    active_id = request.GET.get('id', default_diag.diagram_id)
    active_diagram = SingleLineDiagram.objects.filter(diagram_id=active_id).first() or default_diag

    context = {
        'active_diagram': active_diagram,
        'diagrams': diagrams,
    }
    return render(request, 'sld/editor.html', context)


def get_diagram_api(request, diagram_id):
    """Return diagram JSON schema."""
    diag = SingleLineDiagram.objects.filter(diagram_id=diagram_id).first()
    if not diag:
        # Fallback to default
        schema = get_default_sld_schema()
        return JsonResponse({'diagram_id': diagram_id, 'schema_data': schema, 'title': '154kV Substation'})
    
    return JsonResponse({
        'diagram_id': diag.diagram_id,
        'title': diag.title,
        'description': diag.description,
        'schema_data': diag.schema_data,
        'updated_at': diag.updated_at.isoformat() if diag.updated_at else None
    })


@csrf_exempt
def save_diagram_api(request, diagram_id):
    """Save or update diagram JSON schema."""
    if request.method in ['POST', 'PUT']:
        try:
            body = json.loads(request.body.decode('utf-8'))
            schema_data = body.get('schema_data', {})
            title = body.get('title')

            diag, created = SingleLineDiagram.objects.get_or_create(
                diagram_id=diagram_id,
                defaults={'title': title or '프로젝트 01', 'schema_data': schema_data}
            )

            if not created:
                diag.schema_data = schema_data
                if title:
                    diag.title = title
                diag.save()

            return JsonResponse({
                'status': 'success',
                'diagram_id': diag.diagram_id,
                'updated_at': diag.updated_at.strftime('%H:%M:%S')
            })
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    
    return JsonResponse({'status': 'invalid method'}, status=405)


@csrf_exempt
def diagram_api(request, diagram_id):
    """Unified API for GET (load) and POST (save) diagram schema."""
    if request.method == 'GET':
        return get_diagram_api(request, diagram_id)
    elif request.method in ['POST', 'PUT']:
        return save_diagram_api(request, diagram_id)
    return JsonResponse({'status': 'invalid method'}, status=405)


def telemetry_api(request, diagram_id):
    """Simulate real-time switch states & P/Q/V measurements for HTMX polling."""
    # Generate realistic power system telemetry with slight noise
    freq = round(60.0 + random.uniform(-0.03, 0.03), 2)
    v_154 = round(154.0 + random.uniform(-0.8, 0.8), 1)
    v_229 = round(22.9 + random.uniform(-0.15, 0.15), 2)
    v_380 = round(380.0 + random.uniform(-2.5, 2.5), 1)
    
    active_mw = round(14.8 + random.uniform(-0.4, 0.4), 2)
    reactive_mvar = round(2.3 + random.uniform(-0.2, 0.2), 2)
    power_factor = round(98.8 + random.uniform(-0.3, 0.3), 1)
    current_a = round(372.0 + random.uniform(-8.0, 8.0), 1)

    now_str = timezone.localtime().strftime('%H:%M:%S')

    if request.headers.get('HX-Request'):
        # Return HTMX partial
        context = {
            'frequency': freq,
            'v_154': v_154,
            'v_229': v_229,
            'v_380': v_380,
            'active_mw': active_mw,
            'reactive_mvar': reactive_mvar,
            'power_factor': power_factor,
            'current_a': current_a,
            'timestamp': now_str,
            'diagram_id': diagram_id
        }
        return render(request, 'sld/partials/telemetry_panel.html', context)

    return JsonResponse({
        'timestamp': now_str,
        'frequency_hz': freq,
        'voltage_154kv': v_154,
        'voltage_22_9kv': v_229,
        'voltage_380v': v_380,
        'active_power_mw': active_mw,
        'reactive_power_mvar': reactive_mvar,
        'power_factor_percent': power_factor,
        'current_a': current_a
    })


@csrf_exempt
def create_project_api(request):
    """Create a new project."""
    if request.method == 'POST':
        title = request.POST.get('title') or '새 프로젝트'
        schema = get_default_sld_schema()
        diag = SingleLineDiagram.objects.create(
            title=title,
            schema_data=schema
        )
        return JsonResponse({'status': 'ok', 'diagram_id': diag.diagram_id, 'redirect_url': f'/?id={diag.diagram_id}'})
    return JsonResponse({'status': 'invalid method'}, status=405)
