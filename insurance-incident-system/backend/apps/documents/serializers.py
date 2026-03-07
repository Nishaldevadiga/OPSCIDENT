from rest_framework import serializers
from django.conf import settings
from .models import Document


class DocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'ticket', 'file', 'original_filename', 'file_type', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'file_type', 'file_size', 'uploaded_at']

    def validate_file(self, value):
        if value.size > settings.MAX_UPLOAD_SIZE:
            raise serializers.ValidationError(
                f"File size exceeds maximum allowed ({settings.MAX_UPLOAD_SIZE / 1024 / 1024}MB)"
            )

        content_type = value.content_type
        if content_type not in settings.ALLOWED_FILE_TYPES:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. Allowed types: PDF, JPEG, PNG"
            )

        return value

    def create(self, validated_data):
        file = validated_data['file']
        content_type = file.content_type

        if content_type == 'application/pdf':
            file_type = 'pdf'
        else:
            file_type = 'image'

        validated_data['file_type'] = file_type
        validated_data['file_size'] = file.size
        validated_data['original_filename'] = file.name

        return super().create(validated_data)


class DocumentListSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ['id', 'ticket', 'file_type', 'original_filename', 'file_size', 'file_url', 'uploaded_at']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None
