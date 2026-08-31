using System.Runtime.Serialization;
using Microsoft.VisualStudio.Extensibility.UI;

namespace StarTime.VisualStudio;

[DataContract]
internal sealed class StarTimeStatusData : NotifyPropertyChangedObject
{
    private string text = string.Empty;

    [DataMember]
    public string Text
    {
        get => this.text;
        set => this.SetProperty(ref this.text, value);
    }
}
