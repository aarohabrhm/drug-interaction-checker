# Generated by Django 5.1.6 on 2025-02-23 13:19

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('interactions', '0002_rename_description_druginteraction_interaction_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='druginteraction',
            name='source',
            field=models.CharField(default='local', max_length=50),
        ),
        migrations.AlterField(
            model_name='druginteraction',
            name='drug_1',
            field=models.CharField(db_index=True, max_length=255),
        ),
        migrations.AlterField(
            model_name='druginteraction',
            name='drug_2',
            field=models.CharField(db_index=True, max_length=255),
        ),
        migrations.AddIndex(
            model_name='druginteraction',
            index=models.Index(fields=['drug_1', 'drug_2'], name='interaction_drug_1_69375c_idx'),
        ),
    ]
