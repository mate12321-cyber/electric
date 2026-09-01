from django.db import models
import uuid

class SingleLineDiagram(models.Model):
    diagram_id = models.CharField(max_length=64, unique=True, db_index=True, default=uuid.uuid4)
    title = models.CharField(max_length=255, default="프로젝트 01")
    description = models.TextField(blank=True, default="")
    schema_data = models.JSONField(default=dict, help_text="JointJS graph cells and SLD metadata")
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = '전력 계통도'
        verbose_name_plural = '전력 계통도 목록'

    def __str__(self):
        return f"{self.title} ({self.diagram_id})"

