from django.urls import path

from . import views

urlpatterns = [
    path("signup/", views.signup, name="signup"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("user/", views.get_user_details, name="user-details"),
    path("user/update/", views.update_profile, name="update_profile"),
    path("user/password/", views.change_password, name="change_password"),
]
