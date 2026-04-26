from rest_framework import serializers
from django.conf import settings
from .models import Document


class DocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'ticket', 'file', 'original_filename', 'file_type', 'file_size', 'uploaded_at']
        read_only_fields = ['id', 'file_type', 'file_size', 'uploaded_at']

    VIDEO_MIME_TYPES = {'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo'}

    def validate_file(self, value):
        content_type = value.content_type
        is_video = content_type in self.VIDEO_MIME_TYPES

        size_limit = settings.MAX_VIDEO_UPLOAD_SIZE if is_video else settings.MAX_UPLOAD_SIZE
        if value.size > size_limit:
            limit_mb = size_limit / 1024 / 1024
            raise serializers.ValidationError(
                f"File size exceeds the {limit_mb:.0f} MB limit for {('video' if is_video else 'this file type')}."
            )

        if content_type not in settings.ALLOWED_FILE_TYPES:
            raise serializers.ValidationError(
                f"File type '{content_type}' is not allowed. Allowed types: PDF, JPEG, PNG, MP4, MOV, WebM."
            )

        # Magic-byte validation — skip for video (container formats vary widely)
        if not is_video:
            header = value.read(16)
            value.seek(0)
            if not self._is_supported_format(header):
                raise serializers.ValidationError(
                    "Unsupported image format. Please upload a JPEG, PNG, or WebP file. "
                    "iPhone users: open the photo in Photos, tap Share → Save as JPEG before uploading."
                )

        return value

    @staticmethod
    def _is_supported_format(header: bytes) -> bool:
        """Check magic bytes to confirm JPEG, PNG, WebP, or PDF."""
        if header[:3] == b'\xff\xd8\xff':                      # JPEG
            return True
        if header[:8] == b'\x89PNG\r\n\x1a\n':                # PNG
            return True
        if header[:4] == b'RIFF' and header[8:12] == b'WEBP':  # WebP
            return True
        if header[:4] == b'%PDF':                              # PDF
            return True
        return False

    def create(self, validated_data):
        file = validated_data['file']
        content_type = file.content_type

        if content_type == 'application/pdf':
            file_type = 'pdf'
        elif content_type in self.VIDEO_MIME_TYPES:
            file_type = 'video'
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
