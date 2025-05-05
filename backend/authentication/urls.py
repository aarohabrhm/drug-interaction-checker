from django.urls import path
from .views import signup, login_view
from .views import get_user_details

urlpatterns = [
    path('signup/', signup, name='signup'),
    path('login/', login_view, name='login'),
    path('user/', get_user_details, name='user-details'),
]
