from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json
from .models import Doctor
from rest_framework.authtoken.models import Token
from rest_framework.authentication import TokenAuthentication
from rest_framework.decorators import authentication_classes, permission_classes
from rest_framework.permissions import IsAuthenticated

@csrf_exempt
def signup(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            password = data.get("password")

            if User.objects.filter(username=username).exists():
                return JsonResponse({"error": "User already exists"}, status=400)

            user = User.objects.create_user(username=username, password=password)
            return JsonResponse({"message": "User created successfully"}, status=201)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)

    return JsonResponse({"error": "Invalid request"}, status=400)
    
from django.contrib.auth import login

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        user = authenticate(username=username, password=password)
        if user is not None:
            # Get or create a token for the user
            token, created = Token.objects.get_or_create(user=user)
            doctor = getattr(user, "doctor", None)  # Get related Doctor model if exists

            return JsonResponse({
                'token': token.key,
                'username': user.username,
                'specialty': doctor.specialty if doctor else "Not Specified",
            })
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=400)

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse

@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_user_details(request):
    user = request.user
    doctor = getattr(user, "doctor", None)  # Get related Doctor model if exists

    return JsonResponse({
        "username": user.username,
        "specialty": doctor.specialty if doctor else "Not Specified",
    })
