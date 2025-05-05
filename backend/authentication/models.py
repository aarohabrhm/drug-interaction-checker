from django.contrib.auth.models import User
from django.db import models

class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)  # Link to built-in User model
    specialty = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return self.user.username
